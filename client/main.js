window.onload = function() {

    var game = new Game(30, 30);
    game.on('network.connect', function() {
        this.join(1);
    });
    game.connect(document.location.hostname, network.PORT, 'Ivo');

};
