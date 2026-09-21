import * as fs from 'fs';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let existsSpy: jest.SpyInstance;
  let readSpy: jest.SpyInstance;
  let writeSpy: jest.SpyInstance;
  let mkdirSpy: jest.SpyInstance;

  beforeEach(() => {
    service = new UsersService();
    existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    readSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue('[]');
    writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);
    mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns an empty list when the store does not exist', () => {
    expect(service.findByEmail('missing@example.com')).toBeUndefined();
    expect(existsSpy).toHaveBeenCalled();
    expect(readSpy).not.toHaveBeenCalled();
  });

  it('creates and persists a user with normalized email and trimmed username', () => {
    const user = service.create('  Test User  ', ' TEST@Example.COM ', 'password123');

    expect(user).toEqual({
      id: 1,
      username: 'Test User',
      email: 'test@example.com',
      password: 'password123',
    });
    expect(mkdirSpy).toHaveBeenCalled();
    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining('data'),
      JSON.stringify([user], null, 2),
      'utf-8',
    );
  });

  it('finds users by normalized email', () => {
    existsSpy.mockReturnValue(true);
    readSpy.mockReturnValue(
      JSON.stringify([
        { id: 3, username: 'Test User', email: 'test@example.com', password: 'password123' },
      ]),
    );

    expect(service.findByEmail(' TEST@EXAMPLE.COM ')).toEqual({
      id: 3,
      username: 'Test User',
      email: 'test@example.com',
      password: 'password123',
    });
  });

  it('finds a user by id', () => {
    existsSpy.mockReturnValue(true);
    readSpy.mockReturnValue(
      JSON.stringify([
        { id: 3, username: 'Test User', email: 'test@example.com', password: 'password123' },
      ]),
    );

    expect(service.findById(3)?.email).toBe('test@example.com');
    expect(service.findById(99)).toBeUndefined();
  });

  it('generates an unused sequential id', () => {
    existsSpy.mockReturnValue(true);
    readSpy.mockReturnValue(
      JSON.stringify([
        { id: 1, username: 'One', email: 'one@example.com', password: 'password123' },
        { id: 3, username: 'Three', email: 'three@example.com', password: 'password123' },
      ]),
    );

    const user = service.create('Two', 'two@example.com', 'password123');
    expect(user.id).toBe(2);
  });

  it('recovers from malformed persisted data as an empty store', () => {
    existsSpy.mockReturnValue(true);
    readSpy.mockReturnValue('{invalid-json');

    expect(service.findByEmail('missing@example.com')).toBeUndefined();
  });
});
