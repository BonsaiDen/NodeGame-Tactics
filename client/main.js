window.onload = function() {

    var client = new Client(30, 30, Game);

    client.on('connect', function() {
        this.joinGame(1);
    });

    client.connect(document.location.hostname, network.PORT, 'Ivo');

};
