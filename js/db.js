const DB = (() => {
  let db;

  function abrir() {
    return new Promise((res, rej) => {
      const req = indexedDB.open('asistenteDB', 1);
      req.onupgradeneeded = e => {
        const d = e.target.result;
        d.createObjectStore('registros', { keyPath: 'id', autoIncrement: true });
      };
      req.onsuccess = e => { db = e.target.result; res(db); };
      req.onerror = () => rej(req.error);
    });
  }

  function tx(modo) {
    return db.transaction('registros', modo).objectStore('registros');
  }

  const promesa = req => new Promise((res, rej) => {
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });

  return {
    abrir,
    agregar: reg => promesa(tx('readwrite').add(reg)),
    todos: () => promesa(tx('readonly').getAll()),
    eliminar: id => promesa(tx('readwrite').delete(id)),
    limpiar: () => promesa(tx('readwrite').clear())
  };
})();