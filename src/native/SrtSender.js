import { registerPlugin } from '@capacitor/core';

export const KdrSrt = registerPlugin('KdrSrt', {
  web: () => import('./SrtSenderWeb.js').then((m) => new m.SrtSenderWeb()),
});
