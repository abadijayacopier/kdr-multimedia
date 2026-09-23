export class SrtSenderWeb {
  async start() {
    throw new Error('Native SRT sender is only available in the Android app.');
  }

  async stop() {
    return { running: false, reconnecting: false, error: null };
  }

  async status() {
    return { running: false, reconnecting: false, error: null };
  }
}
