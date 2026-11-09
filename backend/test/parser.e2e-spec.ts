import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { ExpensesService } from '../src/expenses/expenses.service';

describe('ParserController (e2e)', () => {
  let guardedApp: INestApplication<App>;
  let authenticatedApp: INestApplication<App>;
  let expenseCreateSpy: jest.SpyInstance;

  beforeAll(async () => {
    const guardedModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    guardedApp = guardedModule.createNestApplication();
    guardedApp.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await guardedApp.init();

    const authenticatedModule: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    authenticatedApp = authenticatedModule.createNestApplication();
    authenticatedApp.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    expenseCreateSpy = jest.spyOn(
      authenticatedModule.get(ExpensesService),
      'create',
    );
    await authenticatedApp.init();
  });

  afterAll(async () => {
    await Promise.all([guardedApp.close(), authenticatedApp.close()]);
  });

  it('rejects unauthenticated financial text', async () => {
    await request(guardedApp.getHttpServer())
      .post('/parser/parse')
      .send({ text: 'Lunch INR 200 today' })
      .expect(401);
  });

  it('returns a ready authenticated draft without persistence', async () => {
    const response = await request(authenticatedApp.getHttpServer())
      .post('/parser/parse')
      .send({ text: 'Lunch at Bistro USD 20 on 2026-11-09' })
      .expect(201);

    expect(response.body).toMatchObject({
      status: 'READY',
      draft: {
        amount: 20,
        currency: 'USD',
        category: 'Food & Dining',
        merchant: 'Bistro',
        date: '2026-11-09',
      },
      missingFields: [],
    });
    expect(expenseCreateSpy).not.toHaveBeenCalled();
  });

  it('returns date and split clarification for vague shared spending', async () => {
    const response = await request(authenticatedApp.getHttpServer())
      .post('/parser/parse')
      .send({
        text: 'we spent 5000 on travelling few days ago',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      status: 'NEEDS_CLARIFICATION',
      draft: {
        amount: 5000,
        category: 'Transportation',
        date: null,
      },
      missingFields: ['date', 'split'],
    });
    expect(expenseCreateSpy).not.toHaveBeenCalled();
  });

  it('resolves sub-day relative time in the user timezone', async () => {
    const response = await request(authenticatedApp.getHttpServer())
      .post('/parser/parse')
      .send({
        text: 'half hour ago spent 350 on swiggy food order',
        referenceTimestamp: '2026-11-09T18:45:00.000Z',
        timeZone: 'Asia/Kolkata',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      status: 'READY',
      draft: {
        amount: 350,
        category: 'Food & Dining',
        merchant: 'Swiggy',
        date: '2026-11-09',
      },
      missingFields: [],
    });
    expect(expenseCreateSpy).not.toHaveBeenCalled();
  });

  it('rejects an invalid IANA timezone', async () => {
    await request(authenticatedApp.getHttpServer())
      .post('/parser/parse')
      .send({
        text: 'spent 350 on food half hour ago',
        referenceTimestamp: '2026-11-09T18:45:00.000Z',
        timeZone: 'Mars/Olympus',
      })
      .expect(400);
  });

  it('returns multiple non-persisted drafts with a shared trailing date', async () => {
    const response = await request(authenticatedApp.getHttpServer())
      .post('/parser/parse-batch')
      .send({
        text: 'spent 350 on food, spent 500 on petrol and spent 50 on sweets today',
        referenceTimestamp: '2026-11-10T06:30:00.000Z',
        timeZone: 'Asia/Kolkata',
      })
      .expect(201);

    const body = response.body as {
      status: string;
      drafts: Array<{ draft: { amount: number } }>;
    };
    expect(body.status).toBe('READY');
    expect(body.drafts).toHaveLength(3);
    expect(body.drafts.map((draft) => draft.draft.amount)).toEqual([
      350, 500, 50,
    ]);
    expect(expenseCreateSpy).not.toHaveBeenCalled();
  });

  it('inherits a repeated expense verb for a shortened batch clause', async () => {
    const response = await request(authenticatedApp.getHttpServer())
      .post('/parser/parse-batch')
      .send({
        text: 'I spent 400 on petrol today, spent 1000 on food orders yesterday and 500 on movie tickets 3 days ago',
        referenceTimestamp: '2026-11-10T06:30:00.000Z',
        timeZone: 'Asia/Kolkata',
      })
      .expect(201);

    const body = response.body as {
      drafts: Array<{
        draft: { amount: number; category: string; date: string };
      }>;
    };
    expect(body.drafts).toHaveLength(3);
    expect(body.drafts.map((draft) => draft.draft.amount)).toEqual([
      400, 1000, 500,
    ]);
    expect(body.drafts.map((draft) => draft.draft.category)).toEqual([
      'Transportation',
      'Food & Dining',
      'Entertainment',
    ]);
    expect(body.drafts.map((draft) => draft.draft.date)).toEqual([
      '2026-11-10',
      '2026-11-09',
      '2026-11-07',
    ]);
    expect(expenseCreateSpy).not.toHaveBeenCalled();
  });

  it.each([
    [{ text: '' }, 'text'],
    [{ text: 'Lunch INR 200 today', unexpected: true }, 'unexpected'],
  ])('rejects invalid parser request %o', async (body, field) => {
    const response = await request(authenticatedApp.getHttpServer())
      .post('/parser/parse')
      .send(body)
      .expect(400);

    const responseBody = response.body as unknown;
    expect(
      typeof responseBody === 'object' &&
        responseBody !== null &&
        'message' in responseBody,
    ).toBe(true);
    const message = (responseBody as { message: unknown }).message;
    expect(Array.isArray(message)).toBe(true);
    expect(
      Array.isArray(message) &&
        message.some(
          (item) => typeof item === 'string' && item.includes(field),
        ),
    ).toBe(true);
  });
});
