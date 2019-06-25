const ssid = 'WiFi_OBDII';
const host = '192.168.0.10';
const port = '35000';

const wifi = require('Wifi');
const net = require('net');
const logos = require('logos');
const spi = new SPI();

var socket;
var rtc;
var g;
var data = '';

const modes = ['clock', 'date', 'battery'];
var selectedMode = 0;

require("FontDylex7x13").add(Graphics);

Graphics.prototype.drawStringDbl = (txt, px, py, h) => {
    let gBuffer = Graphics.createArrayBuffer(128, h, 2, {
        msb: true
    });
    gBuffer.setFontDylex7x13();
    let w = gBuffer.stringWidth(txt);
    let c = (w + 3) >> 2;
    gBuffer.drawString(txt);
    let img = {
        width: w * 2,
        height: 1,
        transparent: 0,
        buffer: new ArrayBuffer(c)
    };
    let a = new Uint8Array(img.buffer);
    for (let y = 0; y < h; y++) {
        a.set(new Uint8Array(gBuffer.buffer, 32 * y, c));
        this.drawImage(img, px, py + y * 2);
        this.drawImage(img, px, py + 1 + y * 2);
    }
};

function initDisplay() {
    I2C1.setup({
        scl: 5,
        sda: 4
    });
    g = require("SSD1306").connect(I2C1, '', {
        height: 32
    });
}

function initClock() {
    I2C1.setup({
        scl: 5,
        sda: 4
    });
    rtc = require("DS3231").connect(I2C1, {
        DST: false
    });
}

function connectSocket() {
    net.connect({
        host: host,
        port: port
    }, (s, err) => {
        if (err) {
            console.log("Connection error: " + err);
            return;
        }
        socket = s;
        console.log('Connected to socket.');
    });
}

function connectWiFi() {
    console.log('Trying to connect to ' + ssid + '.');
    wifi.connect(ssid, {}, () => {
        console.log('WiFi connected.');
        connectSocket();
    });
}

function sendCMDSocket(cmd) {
    socket.write(cmd + '\r\n');
    return socket.read(0).split('>')[0].trim().replace(cmd, '');
}

function sendCMD(cmd) {
    if (socket) {
        if (!socket.conn) {
            connectSocket();
            console.log('Connection to the socket lost. Reconnecting...');
            return null;
        }
        return sendCMDSocket(cmd);
    } else {
        console.log('Socket has not been initialized yet.');
        return null;
    }
}

function showClock() {
    const time = rtc.readDateTime().split(' ')[1];
    const hms = time.split(':');
    const hmsStr = hms[0] + ' : ' + hms[1] + ' : ' + hms[2];
    if (hms) {
        g.clear();
        g.drawStringDbl(hmsStr, 12, 3, 32);
        g.flip();
    }
}

function showDate() {
    const date = rtc.readDateTime().split(' ')[0];
    const dmy = date.split('/');
    const mdy = dmy[1] + '/' + dmy[0] + '/20' + dmy[2];
    if (date) {
        g.clear();
        g.drawStringDbl(mdy, 3, 3, 32);
        g.flip();
    }
}

function showBattery() {
    const tmp = sendCMD('ATRV');
    if (tmp) data = tmp;
    g.clear();
    g.drawImage(logos.battery, 0, 0);
    if (data) g.drawStringDbl(data, 42, 3, 32);
    g.flip();
}

E.on('init', () => {
    pinMode(2, 'input_pullup');
    pinMode(0, 'input_pullup');

    setWatch(function(e) {
        selectedMode = ((selectedMode + 1) === modes.length) ?
            0 :
            selectedMode + 1;
    }, 2, {
        repeat: true,
        edge: 'rising',
        debounce: 50
    });

    setWatch(function(e) {
        const isLongPress = (e.time - e.lastTime) > 0.5;
        if (isLongPress) {
            console.log('H LONG press');
        } else {
            console.log('H SHORT press');
        }
    }, 0, {
        repeat: true,
        edge: 'rising',
        debounce: 50
    });

    initDisplay();
    initClock();
    connectWiFi();

    setInterval(() => {
        switch (modes[selectedMode]) {
            case 'clock':
                showClock();
                break;
            case 'date':
                showDate();
                break;
            case 'battery':
                showBattery();
                break;
        }
    }, 200);
});