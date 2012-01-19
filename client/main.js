window.onload = function() {

    var client = new ticked.Client(30, 30, Game);

    client.on('connect', function() {
        this.joinGame(1);
    });

    client.on('error', function(msg) {
        console.log('Error:', ticked.network.ErrorMap[msg.code]);
        //document.location.pathname = '/auth';
    });

    client.connect(document.location.hostname, ticked.network.PORT, 'Ivo');

};
