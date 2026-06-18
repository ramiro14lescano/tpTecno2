let obra = [];

let cantidadCapas = 6;
let cantidadLineas = 60;
let impactoAplauso = 0;
let panelUso;
let estadoMicrofonoTexto;
let estadoModeloTexto;
let confianzaAplausoTexto;
let sensibilidadTexto;
let controlSensibilidad;
let botonMicrofono;

// Configura el lienzo, prepara el modelo ML y genera la obra inicial.
function setup() {
  createCanvas(800, 800);
  frameRate(60);
  pixelDensity(1);

  prepararModeloAplausosML();
  configurarSensibilidadMicrofono(60);
  crearPanelUso();
  crearObra();
}

// Actualiza la interaccion sonora y dibuja la obra.
function draw() {
  background(30);

  actualizarVoz();
  actualizarPanelUso();

  if (aplausoDetectado) {
    reaccionarAplauso();
  }

  impactoAplauso = lerp(impactoAplauso, 0, 0.16);

  for (let pieza of obra) {
    pieza.fondo.actualizar(nivelVoz);
    pieza.fondo.mostrar();

    pieza.lineas.actualizar(max(vibracionAgudos, impactoAplauso));
    pieza.lineas.mostrar();
  }
}

// Genera la composicion visual completa.
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

// Crea el cuadro con instrucciones y controles de microfono.
function crearPanelUso() {
  panelUso = createDiv();
  panelUso.position(18, 18);
  panelUso.style("position", "fixed");
  panelUso.style("z-index", "10");
  panelUso.style("width", "min(330px, calc(100vw - 36px))");
  panelUso.style("padding", "15px");
  panelUso.style("border-radius", "8px");
  panelUso.style("background", "rgba(20, 20, 22, 0.88)");
  panelUso.style("border", "1px solid rgba(255, 255, 255, 0.22)");
  panelUso.style("box-shadow", "0 14px 32px rgba(0, 0, 0, 0.32)");
  panelUso.style("color", "#f4f4f5");
  panelUso.style("font-family", "Arial, sans-serif");
  panelUso.style("line-height", "1.35");

  let titulo = createDiv("Uso de la obra");
  titulo.parent(panelUso);
  titulo.style("font-size", "17px");
  titulo.style("font-weight", "700");
  titulo.style("margin-bottom", "8px");

  let instrucciones = createDiv("1. Activa el microfono.<br>2. Habla cerca para mover las ondas.<br>3. Aplaudi para invertir los colores.<br>4. Ajusta la sensibilidad si no responde o responde demasiado.");
  instrucciones.parent(panelUso);
  instrucciones.style("font-size", "13px");
  instrucciones.style("color", "#dddde3");
  instrucciones.style("margin-bottom", "12px");

  botonMicrofono = createButton("Activar microfono");
  botonMicrofono.parent(panelUso);
  botonMicrofono.mousePressed(iniciarMicrofono);
  botonMicrofono.style("width", "100%");
  botonMicrofono.style("min-height", "40px");
  botonMicrofono.style("border", "0");
  botonMicrofono.style("border-radius", "8px");
  botonMicrofono.style("background", "#f2c94c");
  botonMicrofono.style("color", "#171717");
  botonMicrofono.style("font-weight", "700");
  botonMicrofono.style("cursor", "pointer");

  sensibilidadTexto = createDiv("Sensibilidad: 60%");
  sensibilidadTexto.parent(panelUso);
  sensibilidadTexto.style("font-size", "13px");
  sensibilidadTexto.style("font-weight", "700");
  sensibilidadTexto.style("margin-top", "12px");

  controlSensibilidad = createSlider(0, 100, 60, 1);
  controlSensibilidad.parent(panelUso);
  controlSensibilidad.input(cambiarSensibilidadDesdePanel);
  controlSensibilidad.style("width", "100%");
  controlSensibilidad.style("accent-color", "#f2c94c");

  estadoMicrofonoTexto = createDiv("Microfono: apagado");
  estadoMicrofonoTexto.parent(panelUso);
  estadoMicrofonoTexto.style("font-size", "12px");
  estadoMicrofonoTexto.style("color", "#b9bac3");
  estadoMicrofonoTexto.style("margin-top", "8px");

  estadoModeloTexto = createDiv("Modelo: cargando");
  estadoModeloTexto.parent(panelUso);
  estadoModeloTexto.style("font-size", "12px");
  estadoModeloTexto.style("color", "#b9bac3");

  confianzaAplausoTexto = createDiv("Aplauso ML: 0%");
  confianzaAplausoTexto.parent(panelUso);
  confianzaAplausoTexto.style("font-size", "12px");
  confianzaAplausoTexto.style("color", "#b9bac3");
}

// Aplica el valor elegido en el control de sensibilidad.
function cambiarSensibilidadDesdePanel() {
  let valor = controlSensibilidad.value();
  configurarSensibilidadMicrofono(valor);
  sensibilidadTexto.html("Sensibilidad: " + valor + "%");
}

// Actualiza los textos del cuadro de uso.
function actualizarPanelUso() {
  if (!estadoMicrofonoTexto || !estadoModeloTexto || !confianzaAplausoTexto || !botonMicrofono) {
    return;
  }

  if (microfonoListo) {
    estadoMicrofonoTexto.html("Microfono: activo");
    botonMicrofono.html("Microfono activo");
    botonMicrofono.attribute("disabled", "");
    botonMicrofono.style("opacity", "0.72");
    botonMicrofono.style("cursor", "default");
  } else if (microfonoSolicitado) {
    estadoMicrofonoTexto.html("Microfono: esperando permiso");
    botonMicrofono.html("Esperando permiso");
  } else {
    estadoMicrofonoTexto.html("Microfono: apagado");
  }

  estadoModeloTexto.html("Modelo: " + estadoModeloAplausos);
  confianzaAplausoTexto.html("Aplauso ML: " + round(confianzaAplauso * 100) + "% " + etiquetaActualModeloAplausos);
}

// Dispara la reaccion visual cuando el modelo ML reconoce un aplauso.
function reaccionarAplauso() {
  invertirColoresObra();
  impactoAplauso = 1;
}

// Intercambia los colores del fondo y las lineas.
function invertirColoresObra() {
  for (let pieza of obra) {
    pieza.paleta.invertir();

    pieza.fondo.colores = pieza.paleta.coloresFondo;
    pieza.lineas.colores = pieza.paleta.coloresLineas;
  }
}

// Activa el microfono con un clic del mouse.
function mousePressed() {
  iniciarMicrofono();
}

// Activa el microfono con un toque en pantallas tactiles.
function touchStarted() {
  iniciarMicrofono();
  return false;
}
