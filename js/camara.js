const Camara = (() => {
  let stream;
  const video = () => document.getElementById('video');
  const canvas = () => document.getElementById('canvas');

  async function abrir() {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }, audio: false
    });
    video().srcObject = stream;
  }

  function cerrar() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    video().srcObject = null;
  }

  function capturar() {
    const v = video(), c = canvas();
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    return new Promise(res => c.toBlob(res, 'image/jpeg', 0.8));
  }

  return { abrir, cerrar, capturar };
})();