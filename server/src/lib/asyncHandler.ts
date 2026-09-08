import { NextFunction, Request, Response } from "express";

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

// Express 4 does not forward rejected promises from async handlers to the
// error middleware on its own — without this, a thrown error inside an
// `async (req, res) => {...}` route would surface as an unhandled rejection
// instead of a JSON 500 response.
export function asyncHandler(handler: Handler) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}
