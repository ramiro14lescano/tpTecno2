let microfono;
let analizadorTono;

let microfonoListo = false;
let microfonoSolicitado = false;

let nivelVoz = 0;
let nivelGraves = 0;
let nivelAgudos = 0;
let vibracionAgudos = 0;

let nivelAnteriorAplauso = 0;
let ultimoAplauso = -1000;
let bloquearVozHasta = 0;
let aplausoDetectado = false;

let umbralAplauso = 0.10;
let saltoAplauso = 0.08;
let esperaAplauso = 850;

function iniciarMicrofono() {
  if (microfonoListo || microfonoSolicitado) {
    return;
  }

  userStartAudio();

  if (!microfono) {
    microfono = new p5.AudioIn();
  }

  microfonoSolicitado = true;

  microfono.start(
    function () {
      microfonoSolicitado = false;
      microfonoListo = true;
      prepararAnalizadorTono();
    },
    function () {
      microfonoSolicitado = false;
      microfonoListo = false;
    }
  );
}

function prepararAnalizadorTono() {
  if (!analizadorTono) {
    analizadorTono = new p5.FFT(0.82, 512);
  }

  analizadorTono.setInput(microfono);
}

function actualizarVoz() {
  aplausoDetectado = false;

  let nivelCrudo = 0;
  let nivelObjetivo = 0;

  if (microfonoListo && microfono) {
    nivelCrudo = microfono.getLevel();

    if (detectarAplauso(nivelCrudo)) {
      aplausoDetectado = true;
      bloquearVozHasta = millis() + 450;

      nivelVoz = 0;
      vibracionAgudos = 0;

      return nivelCrudo;
    }

    if (millis() < bloquearVozHasta) {
      nivelVoz = lerp(nivelVoz, 0, 0.4);
      vibracionAgudos = lerp(vibracionAgudos, 0, 0.4);
      return nivelCrudo;
    }

    nivelObjetivo = constrain(map(nivelCrudo, 0.01, 0.30, 0, 1), 0, 1);
  }

  nivelVoz = lerp(nivelVoz, nivelObjetivo, 0.22);

  actualizarTonos(nivelCrudo);

  return nivelCrudo;
}

function actualizarTonos(nivelCrudo) {
  if (!microfonoListo || !analizadorTono) {
    nivelGraves = lerp(nivelGraves, 0, 0.18);
    nivelAgudos = lerp(nivelAgudos, 0, 0.18);
    vibracionAgudos = lerp(vibracionAgudos, 0, 0.18);
    return;
  }

  analizadorTono.analyze();

  let gravesCrudos = analizadorTono.getEnergy(80, 250) / 255;
  let mediosCrudos = analizadorTono.getEnergy(250, 1200) / 255;
  let agudosCrudos = analizadorTono.getEnergy(1200, 3000) / 255;

  let relacionAguda = agudosCrudos / (gravesCrudos + mediosCrudos + 0.001);

  let objetivoVibracion = 0;

  if (
    nivelCrudo > 0.008 &&
    agudosCrudos > 0.025 &&
    relacionAguda > 0.45
  ) {
    objetivoVibracion = constrain(map(relacionAguda, 0.45, 1.4, 0, 1), 0, 1);
  }

  nivelGraves = lerp(nivelGraves, gravesCrudos, 0.22);
  nivelAgudos = lerp(nivelAgudos, agudosCrudos, 0.22);

  vibracionAgudos = lerp(
    vibracionAgudos,
    objetivoVibracion,
    objetivoVibracion > vibracionAgudos ? 0.28 : 0.12
  );
}

function detectarAplauso(nivelCrudo) {
  let ahora = millis();
  let subidaRapida = nivelCrudo - nivelAnteriorAplauso;
  let pasoEspera = ahora - ultimoAplauso > esperaAplauso;

  let hayAplauso =
    nivelCrudo > umbralAplauso &&
    subidaRapida > saltoAplauso &&
    pasoEspera;

  nivelAnteriorAplauso = max(nivelCrudo, nivelAnteriorAplauso * 0.72);

  if (hayAplauso) {
    ultimoAplauso = ahora;
    return true;
  }

  return false;
}
