export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Maʼlumot') => new HttpError(404, `${what} topilmadi`);
export const badRequest = (message: string, details?: unknown) => new HttpError(400, message, details);
