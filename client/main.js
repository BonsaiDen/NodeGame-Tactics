window.onload = function() {

    var client = new ticked.Client(30, 30, Game);

    client.on('connect', function() {
        this.joinGame(1);
    });

    client.connect(document.location.hostname, ticked.network.PORT, 'Ivo');

};
