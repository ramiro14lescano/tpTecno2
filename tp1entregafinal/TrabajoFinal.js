let obra = [];

let cantidadCapas = 6;
let cantidadLineas = 60;

// Configura el lienzo y genera la obra inicial.
function setup() {
  createCanvas(800, 800);
  frameRate(60);
  pixelDensity(1);

  crearObra();
}

// Actualiza la interacción y dibuja la obra.
function draw() {
  background(30);

  let nivelCrudo = actualizarVoz();

  // Un aplauso invierte los colores de la composición.
  if (aplausoDetectado) {
  invertirColoresObra();
}

  for (let pieza of obra) {
    pieza.fondo.actualizar(nivelVoz);
    pieza.fondo.mostrar();

    pieza.lineas.actualizar(vibracionAgudos);
    pieza.lineas.mostrar();
  }
}

// Genera la composición visual completa.
function crearObra() {
  obra = [];

  let capas = cantidadCapas + floor(random(-1, 2));
  let lineasPanel = cantidadLineas + floor(random(-8, 9));
  let paletaPanel = new Paleta(capas, floor(random(4)));

  let fondo = new FondoOndulado(0, 0, width, height, capas, paletaPanel.coloresFondo);
  let lineas = new LineasFrente(0, 0, width, height, lineasPanel, capas, paletaPanel.coloresLineas);

  let pieza = {
    x: 0,
    y: 0,
    w: width,
    h: height,
    paleta: paletaPanel,
    fondo: fondo,
    lineas: lineas
  };

  obra.push(pieza);
}

// Intercambia los colores del fondo y las líneas.
function invertirColoresObra() {
  for (let pieza of obra) {
    pieza.paleta.invertir();

    pieza.fondo.colores = pieza.paleta.coloresFondo;
    pieza.lineas.colores = pieza.paleta.coloresLineas;
  }
}

// Activa el micrófono.
function mousePressed() {
  iniciarMicrofono();
}

function touchStarted() {
  iniciarMicrofono();
  return false;
}
