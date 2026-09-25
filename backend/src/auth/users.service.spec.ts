import * as fs from 'fs';
import { UsersService } from './users.service';

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

describe('UsersService', () => {
  let service: UsersService;
  const existsMock = jest.mocked(fs.existsSync);
  const readMock = jest.mocked(fs.readFileSync);
  const writeMock = jest.mocked(fs.writeFileSync);
  const mkdirMock = jest.mocked(fs.mkdirSync);

  beforeEach(() => {
    service = new UsersService();
    existsMock.mockReturnValue(false);
    readMock.mockReturnValue('[]');
    writeMock.mockImplementation(() => undefined);
    mkdirMock.mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns an empty list when the store does not exist', () => {
    expect(service.findByEmail('missing@example.com')).toBeUndefined();
    expect(existsMock).toHaveBeenCalled();
    expect(readMock).not.toHaveBeenCalled();
  });

  it('creates and persists a user with normalized email and trimmed username', () => {
    const user = service.create('  Test User  ', ' TEST@Example.COM ', 'password123');

    expect(user).toEqual({
      id: 1,
      username: 'Test User',
      email: 'test@example.com',
      password: 'password123',
    });
    expect(mkdirMock).toHaveBeenCalled();
    expect(writeMock).toHaveBeenCalledWith(
      expect.stringContaining('data'),
      JSON.stringify([user], null, 2),
      'utf-8',
    );
  });

  it('finds users by normalized email', () => {
    existsMock.mockReturnValue(true);
    readMock.mockReturnValue(
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
    existsMock.mockReturnValue(true);
    readMock.mockReturnValue(
      JSON.stringify([
        { id: 3, username: 'Test User', email: 'test@example.com', password: 'password123' },
      ]),
    );

    expect(service.findById(3)?.email).toBe('test@example.com');
    expect(service.findById(99)).toBeUndefined();
  });

  it('generates an unused sequential id', () => {
    existsMock.mockReturnValue(true);
    readMock.mockReturnValue(
      JSON.stringify([
        { id: 1, username: 'One', email: 'one@example.com', password: 'password123' },
        { id: 3, username: 'Three', email: 'three@example.com', password: 'password123' },
      ]),
    );

    const user = service.create('Two', 'two@example.com', 'password123');
    expect(user.id).toBe(4);
  });

  it('recovers from malformed persisted data as an empty store', () => {
    existsMock.mockReturnValue(true);
    readMock.mockReturnValue('{invalid-json');

    expect(service.findByEmail('missing@example.com')).toBeUndefined();
  });
});
