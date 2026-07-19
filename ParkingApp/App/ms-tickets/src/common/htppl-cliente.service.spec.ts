import { HttpClientService } from './htppl-cliente.service';

describe('HttpClientService', () => {
  let service: HttpClientService;
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as never;
    service = new HttpClientService();
  });

  it('get propaga el X-Tenant-Id del usuario original', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 1 }) });

    const result = await service.get('http://personas/api/personas/1', 'token-abc', 'tenant-norte');

    expect(result).toEqual({ id: 1 });
    expect(fetchMock).toHaveBeenCalledWith('http://personas/api/personas/1', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-abc',
        'X-Tenant-Id': 'tenant-norte',
      },
    });
  });

  it('get sin tenant no agrega el header X-Tenant-Id', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

    await service.get('http://personas/api/personas/1', 'Bearer ya-con-prefijo');

    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers['X-Tenant-Id']).toBeUndefined();
    expect(headers.Authorization).toBe('Bearer ya-con-prefijo');
  });

  it('get lanza cuando la respuesta no es ok', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' });

    await expect(service.get('http://personas/api/personas/9')).rejects.toThrow();
  });
});
