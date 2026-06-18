let microfono;
let analizadorTono;

let microfonoListo = false;
let microfonoSolicitado = false;

let nivelVoz = 0;
let nivelGraves = 0;
let nivelAgudos = 0;
let vibracionAgudos = 0;

let aplausoDetectado = false;
let confianzaAplauso = 0;
let confianzaAplausoSuavizada = 0;

let modeloAplausosML;
let espectroAnteriorAplauso = [];
let nivelAnteriorAplauso = 0;
let ultimoAplauso = -1000;
let bloquearVozHasta = 0;

let umbralAplauso = 0.30;
let esperaAplauso = 720;
let sensibilidadMicrofono = 0.60;

let clasificadorAplausosTM;
let modeloAplausosTMCargando = false;
let modeloAplausosTMListo = false;
let clasificacionAplausosTMActiva = false;
let estadoModeloAplausos = "modelo manual";
let etiquetaActualModeloAplausos = "";
let etiquetasModeloAplausos = [];
let confianzaModeloAplausosTM = 0;
let umbralModeloAplausosTM = 0.90;
let rutaModeloAplausosTM = "tm-my-audio-model/";

// Activa el microfono despues de una interaccion del usuario.
function iniciarMicrofono() {
  if (microfonoListo || microfonoSolicitado) {
    return;
  }

  userStartAudio();
  prepararModeloAplausosML();

  if (!microfono) {
    microfono = new p5.AudioIn();
  }

  microfonoSolicitado = true;
  activarClasificadorAplausosTM();

  microfono.start(
    function () {
      microfonoSolicitado = false;
      microfonoListo = true;
      prepararAnalizadorTono();
      activarClasificadorAplausosTM();
    },
    function () {
      microfonoSolicitado = false;
      microfonoListo = false;
    }
  );
}

// Prepara el analizador de frecuencias para separar graves, medios y agudos.
function prepararAnalizadorTono() {
  if (!analizadorTono) {
    analizadorTono = new p5.FFT(0.35, 512);
  }

  analizadorTono.setInput(microfono);
}

// Cambia la sensibilidad del detector segun un valor entre 0 y 100.
function configurarSensibilidadMicrofono(valor) {
  sensibilidadMicrofono = constrain(valor / 100, 0, 1);
  umbralAplauso = map(sensibilidadMicrofono, 0, 1, 0.82, 0.42);
}

// Carga el modelo de Teachable Machine entrenado con el sonido de aplauso.
function prepararClasificadorAplausosTM() {
  if (modeloAplausosTMListo || modeloAplausosTMCargando) {
    return;
  }

  if (typeof speechCommands === "undefined") {
    estadoModeloAplausos = "libreria de audio no cargada, usando respaldo";
    return;
  }

  let rutaModelo = obtenerRutaBaseModeloAplausosTM();

  if (!rutaModelo) {
    estadoModeloAplausos = "abrir con localhost para usar el modelo";
    return;
  }

  modeloAplausosTMCargando = true;
  estadoModeloAplausos = "cargando modelo de aplausos";

  try {
    clasificadorAplausosTM = speechCommands.create(
      "BROWSER_FFT",
      undefined,
      new URL("model.json", rutaModelo).href,
      new URL("metadata.json", rutaModelo).href
    );

    clasificadorAplausosTM.ensureModelLoaded()
      .then(modeloAplausosTMPreparado)
      .catch(function () {
        modeloAplausosTMCargando = false;
        estadoModeloAplausos = "modelo local no disponible";
      });
  } catch (error) {
    modeloAplausosTMCargando = false;
    estadoModeloAplausos = "modelo local no disponible";
  }
}

// Convierte la ruta local del modelo en una URL valida para Teachable Machine.
function obtenerRutaBaseModeloAplausosTM() {
  if (typeof window === "undefined" || !window.location) {
    return rutaModeloAplausosTM;
  }

  if (window.location.protocol !== "http:" && window.location.protocol !== "https:") {
    return "";
  }

  return new URL(rutaModeloAplausosTM, window.location.href).href;
}

// Inicia la escucha continua del clasificador de Teachable Machine.
function modeloAplausosTMPreparado() {
  modeloAplausosTMCargando = false;
  modeloAplausosTMListo = true;
  etiquetasModeloAplausos = clasificadorAplausosTM.wordLabels();
  estadoModeloAplausos = "modelo de aplausos listo";

  activarClasificadorAplausosTM();
}

// Activa la clasificacion de audio solo despues de que el usuario pidio microfono.
function activarClasificadorAplausosTM() {
  if (
    !modeloAplausosTMListo ||
    clasificacionAplausosTMActiva ||
    (!microfonoSolicitado && !microfonoListo)
  ) {
    return;
  }

  if (clasificadorAplausosTM && clasificadorAplausosTM.listen) {
    try {
      clasificacionAplausosTMActiva = true;
      clasificadorAplausosTM.listen(recibirResultadoAplausosTM, {
        includeSpectrogram: false,
        invokeCallbackOnNoiseAndUnknown: true,
        overlapFactor: 0.50,
        probabilityThreshold: 0
      });
    } catch (error) {
      clasificacionAplausosTMActiva = false;
      estadoModeloAplausos = "no se pudo activar el modelo";
    }
  }
}

// Recibe las predicciones del modelo y guarda la confianza del aplauso.
function recibirResultadoAplausosTM(resultado) {
  if (!resultado || !resultado.scores) {
    estadoModeloAplausos = "modelo sin lectura";
    return;
  }

  let indiceAplauso = buscarIndiceAplauso(resultado.scores);

  etiquetaActualModeloAplausos = etiquetasModeloAplausos[indiceAplauso] || "";
  confianzaModeloAplausosTM = resultado.scores[indiceAplauso] || 0;
  estadoModeloAplausos = "escuchando modelo de aplausos";
}

// Busca la clase entrenada como aplauso y evita la clase de ruido de fondo.
function buscarIndiceAplauso(puntajes) {
  let mejorIndice = 0;
  let mejorPuntaje = -1;

  for (let i = 0; i < puntajes.length; i++) {
    let etiqueta = etiquetasModeloAplausos[i] || "";

    if (esEtiquetaAplauso(etiqueta) && puntajes[i] > mejorPuntaje) {
      mejorPuntaje = puntajes[i];
      mejorIndice = i;
    }
  }

  return mejorIndice;
}

// Decide si una etiqueta del modelo corresponde al aplauso.
function esEtiquetaAplauso(etiqueta) {
  let nombre = etiqueta.toLowerCase();

  return (
    nombre.length > 0 &&
    nombre.indexOf("ruido") === -1 &&
    nombre.indexOf("fondo") === -1 &&
    nombre.indexOf("background") === -1 &&
    nombre.indexOf("noise") === -1
  );
}

// Entrena una regresion logistica pequena con ejemplos tipicos de aplauso y ambiente.
function prepararModeloAplausosML() {
  prepararClasificadorAplausosTM();

  if (modeloAplausosML) {
    return;
  }

  let datos = [
    { x: [0.03, 0.02, 0.05, 0.04, 0.20, 0.03, 0.06], y: 0 },
    { x: [0.06, 0.04, 0.08, 0.06, 0.28, 0.05, 0.10], y: 0 },
    { x: [0.10, 0.05, 0.12, 0.08, 0.34, 0.08, 0.12], y: 0 },
    { x: [0.16, 0.06, 0.16, 0.10, 0.32, 0.10, 0.16], y: 0 },
    { x: [0.18, 0.10, 0.22, 0.14, 0.40, 0.12, 0.20], y: 0 },
    { x: [0.22, 0.12, 0.18, 0.12, 0.30, 0.11, 0.18], y: 0 },
    { x: [0.35, 0.35, 0.40, 0.35, 0.72, 0.40, 0.55], y: 1 },
    { x: [0.48, 0.45, 0.50, 0.48, 0.86, 0.52, 0.72], y: 1 },
    { x: [0.62, 0.58, 0.60, 0.55, 0.95, 0.68, 0.82], y: 1 },
    { x: [0.75, 0.70, 0.68, 0.64, 0.98, 0.78, 0.92], y: 1 },
    { x: [0.52, 0.62, 0.58, 0.52, 0.88, 0.70, 0.86], y: 1 },
    { x: [0.40, 0.52, 0.46, 0.44, 0.82, 0.60, 0.78], y: 1 }
  ];

  modeloAplausosML = entrenarRegresionLogistica(datos, 7);
}

// Ajusta los pesos del modelo con descenso de gradiente.
function entrenarRegresionLogistica(datos, cantidadRasgos) {
  let pesos = [];

  for (let i = 0; i <= cantidadRasgos; i++) {
    pesos.push(0);
  }

  let tasaAprendizaje = 0.42;

  for (let epoca = 0; epoca < 420; epoca++) {
    for (let dato of datos) {
      let entrada = [1].concat(dato.x);
      let prediccion = activarSigmoide(productoPunto(pesos, entrada));
      let error = dato.y - prediccion;

      for (let i = 0; i < pesos.length; i++) {
        pesos[i] += tasaAprendizaje * error * entrada[i];
      }
    }
  }

  return {
    pesos: pesos
  };
}

// Calcula el producto entre dos vectores numericos.
function productoPunto(a, b) {
  let total = 0;

  for (let i = 0; i < a.length; i++) {
    total += a[i] * b[i];
  }

  return total;
}

// Convierte un puntaje del modelo en una probabilidad entre 0 y 1.
function activarSigmoide(valor) {
  return 1 / (1 + exp(-constrain(valor, -40, 40)));
}

// Actualiza el audio de entrada y devuelve el nivel crudo del microfono.
function actualizarVoz() {
  aplausoDetectado = false;

  let nivelCrudo = 0;
  let nivelObjetivo = 0;
  let rasgos = crearRasgosVacios();

  if (microfonoListo && microfono) {
    nivelCrudo = microfono.getLevel();
    rasgos = calcularRasgosAudio(nivelCrudo);

    if (detectarAplausoML(rasgos)) {
      aplausoDetectado = true;
      bloquearVozHasta = millis() + 350;

      nivelVoz = 0;
      vibracionAgudos = 1;

      return nivelCrudo;
    }

    if (millis() < bloquearVozHasta) {
      nivelVoz = lerp(nivelVoz, 0, 0.4);
      vibracionAgudos = lerp(vibracionAgudos, 0, 0.12);
      actualizarTonos(rasgos);
      return nivelCrudo;
    }

    nivelObjetivo = constrain(map(nivelCrudo, 0.01, 0.30, 0, 1), 0, 1);
  }

  nivelVoz = lerp(nivelVoz, nivelObjetivo, 0.22);

  actualizarTonos(rasgos);

  return nivelCrudo;
}

// Crea un paquete de rasgos neutros para cuando el microfono todavia no esta listo.
function crearRasgosVacios() {
  return {
    nivelCrudo: 0,
    subidaRapida: 0,
    gravesCrudos: 0,
    mediosCrudos: 0,
    agudosCrudos: 0,
    energiaAlta: 0,
    relacionAguda: 0,
    flujoEspectral: 0
  };
}

// Extrae rasgos de volumen y frecuencia que sirven para reconocer aplausos.
function calcularRasgosAudio(nivelCrudo) {
  if (!analizadorTono) {
    return crearRasgosVacios();
  }

  let espectro = analizadorTono.analyze();
  let gravesCrudos = analizadorTono.getEnergy(80, 250) / 255;
  let mediosCrudos = analizadorTono.getEnergy(250, 1200) / 255;
  let agudosCrudos = analizadorTono.getEnergy(400, 4200) / 255;
  let energiaAlta = analizadorTono.getEnergy(2500, 8000) / 255;
  let relacionAguda = agudosCrudos / (gravesCrudos + mediosCrudos + 0.001);
  let subidaRapida = max(0, nivelCrudo - nivelAnteriorAplauso);
  let flujoEspectral = calcularFlujoEspectral(espectro);

  nivelAnteriorAplauso = max(nivelCrudo, nivelAnteriorAplauso * 0.72);

  return {
    nivelCrudo: nivelCrudo,
    subidaRapida: subidaRapida,
    gravesCrudos: gravesCrudos,
    mediosCrudos: mediosCrudos,
    agudosCrudos: agudosCrudos,
    energiaAlta: energiaAlta,
    relacionAguda: relacionAguda,
    flujoEspectral: flujoEspectral
  };
}

// Mide cambios bruscos entre el espectro actual y el anterior.
function calcularFlujoEspectral(espectro) {
  if (espectroAnteriorAplauso.length !== espectro.length) {
    espectroAnteriorAplauso = espectro.slice();
    return 0;
  }

  let flujo = 0;

  for (let i = 0; i < espectro.length; i++) {
    let diferencia = espectro[i] - espectroAnteriorAplauso[i];

    if (diferencia > 0) {
      flujo += diferencia;
    }
  }

  espectroAnteriorAplauso = espectro.slice();

  return constrain(flujo / (espectro.length * 42), 0, 1);
}

// Convierte los rasgos de audio en valores normalizados para el modelo ML.
function normalizarRasgosAplauso(rasgos) {
  return [
    constrain(map(rasgos.nivelCrudo, 0.01, 0.26, 0, 1), 0, 1),
    constrain(map(rasgos.subidaRapida, 0.006, 0.14, 0, 1), 0, 1),
    constrain(map(rasgos.agudosCrudos, 0.02, 0.58, 0, 1), 0, 1),
    constrain(map(rasgos.energiaAlta, 0.01, 0.52, 0, 1), 0, 1),
    constrain(map(rasgos.relacionAguda, 0.35, 2.2, 0, 1), 0, 1),
    constrain(rasgos.flujoEspectral, 0, 1),
    constrain(map(rasgos.subidaRapida + rasgos.flujoEspectral, 0.03, 0.85, 0, 1), 0, 1)
  ];
}

// Usa el modelo entrenado para detectar si el sonido actual parece un aplauso.
function detectarAplausoML(rasgos) {
  prepararModeloAplausosML();

  let ahora = millis();
  let pasoEspera = ahora - ultimoAplauso > esperaAplauso;

  if (modeloAplausosTMListo) {
    confianzaAplauso = confianzaModeloAplausosTM;
    confianzaAplausoSuavizada = lerp(confianzaAplausoSuavizada, confianzaAplauso, 0.35);

    let hayAplausoModelo =
      confianzaModeloAplausosTM > umbralModeloAplausosTM &&
      pasoEspera;

    if (hayAplausoModelo) {
      ultimoAplauso = ahora;
      return true;
    }

    return false;
  }

  let vector = normalizarRasgosAplauso(rasgos);
  let entrada = [1].concat(vector);
  let prediccion = activarSigmoide(productoPunto(modeloAplausosML.pesos, entrada));

  confianzaAplauso = prediccion;
  confianzaAplausoSuavizada = lerp(confianzaAplausoSuavizada, prediccion, 0.35);

  let energiaMinima = map(sensibilidadMicrofono, 0, 1, 0.055, 0.022);
  let subidaMinima = map(sensibilidadMicrofono, 0, 1, 0.040, 0.014);
  let agudosMinimos = map(sensibilidadMicrofono, 0, 1, 0.050, 0.020);
  let energiaSuficiente = rasgos.nivelCrudo > energiaMinima || rasgos.subidaRapida > subidaMinima;
  let golpeAgudo = rasgos.agudosCrudos > agudosMinimos || rasgos.energiaAlta > agudosMinimos;
  let confianzaActiva = max(confianzaAplauso, confianzaAplausoSuavizada);
  let hayAplauso =
    confianzaActiva > umbralAplauso &&
    energiaSuficiente &&
    golpeAgudo &&
    pasoEspera;

  if (hayAplauso) {
    ultimoAplauso = ahora;
    return true;
  }

  return false;
}

// Actualiza los valores que mueven la obra con voz y sonidos agudos.
function actualizarTonos(rasgos) {
  if (!microfonoListo || !analizadorTono) {
    nivelGraves = lerp(nivelGraves, 0, 0.18);
    nivelAgudos = lerp(nivelAgudos, 0, 0.18);
    vibracionAgudos = lerp(vibracionAgudos, 0, 0.18);
    return;
  }

  let objetivoVibracion = 0;

  if (
    rasgos.nivelCrudo > 0.008 &&
    rasgos.agudosCrudos > 0.030 &&
    rasgos.relacionAguda > 0.40
  ) {
    objetivoVibracion = constrain(map(rasgos.relacionAguda, 0.45, 1.4, 0, 1), 0, 1);
  }

  nivelGraves = lerp(nivelGraves, rasgos.gravesCrudos, 0.22);
  nivelAgudos = lerp(nivelAgudos, rasgos.agudosCrudos, 0.22);

  vibracionAgudos = lerp(
    vibracionAgudos,
    objetivoVibracion,
    objetivoVibracion > vibracionAgudos ? 0.28 : 0.12
  );
}
