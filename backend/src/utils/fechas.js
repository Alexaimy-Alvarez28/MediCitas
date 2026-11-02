function fechaValida(texto) {

    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {

        return false;

    }

    const partes = texto.split("-").map(Number);

    const fecha =
        new Date(Date.UTC(partes[0], partes[1] - 1, partes[2]));

    return (
        fecha.getUTCFullYear() === partes[0] &&
        fecha.getUTCMonth() === partes[1] - 1 &&
        fecha.getUTCDate() === partes[2]
    );

}


function fechaDeHoy() {

    return new Date().toLocaleDateString("en-CA");

}


module.exports = { fechaValida, fechaDeHoy };