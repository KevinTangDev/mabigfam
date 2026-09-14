// Tells React that act() is expected here, which silences the
// "testing environment is not configured to support act(...)" warning.
declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

export {};
