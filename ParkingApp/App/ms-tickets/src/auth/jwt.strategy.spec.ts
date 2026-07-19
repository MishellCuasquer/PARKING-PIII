import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const configServiceMock = {
    get: jest.fn((_key: string, defaultValue?: string) => defaultValue),
  };

  const strategy = new JwtStrategy(configServiceMock as never);

  it('validate expone userId, username, roles y tenantId del payload', () => {
    const result = strategy.validate({
      sub: 'nora_norte',
      userId: 'u-1',
      roles: ['ADMIN'],
      tenantId: 't-norte',
    });

    expect(result).toEqual({
      userId: 'u-1',
      username: 'nora_norte',
      roles: ['ADMIN'],
      tenantId: 't-norte',
    });
  });

  it('validate usa null para tokens globales sin tenantId y [] sin roles', () => {
    const result = strategy.validate({ sub: 'superadmin', userId: 'u-2' } as never);

    expect(result.tenantId).toBeNull();
    expect(result.roles).toEqual([]);
  });
});
