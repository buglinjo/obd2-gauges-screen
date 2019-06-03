const ssid = 'WiFi_OBDII';
const host = '192.168.0.10';
const port = '35000';

require("FontDylex7x13").add(Graphics);

const wifi = require('Wifi');
const net = require('net');
const spi = new SPI();

let socket;
let rtc;
let g;

const modes = ['clock', 'battery'];
let selectedMode = 0;

var battery = {
  width : 32, height : 32, bpp : 1,
  transparent : 0,
  buffer : new Uint8Array([
    0b00000000, 0b00000000, 0b00000000, 0b00000000, //
    0b00000000, 0b00000000, 0b00000000, 0b00000000, //
    0b00000000, 0b00000000, 0b00000000, 0b00000000, //
    0b00000000, 0b00000000, 0b00000000, 0b00000000, //
    0b00000000, 0b00000000, 0b00000000, 0b00000000, //
    0b00000001, 0b11110000, 0b00011111, 0b00000000, //        #####       #####
    0b00000010, 0b00001000, 0b00100000, 0b10000000, //       #     #     #     #
    0b00000010, 0b00001000, 0b00100000, 0b10000000, //       #     #     #     #
    0b00000010, 0b00001000, 0b00100000, 0b10000000, //       #     #     #     #
    0b00000010, 0b00001000, 0b00100000, 0b10000000, //       #     #     #     #
    0b00000010, 0b00001000, 0b00100000, 0b10000000, //       #     #     #     #
    0b00011111, 0b11111111, 0b11111111, 0b11110000, //    #########################
    0b00011110, 0b00000000, 0b00000000, 0b11110000, //    ####                 ####
    0b00011110, 0b00000000, 0b00000000, 0b11110000, //    ####                 ####
    0b00011110, 0b00000000, 0b00000000, 0b11110000, //    ####                 ####
    0b00010000, 0b01000000, 0b00000000, 0b00010000, //    #     #                 #
    0b00010000, 0b01000000, 0b00000000, 0b00010000, //    #     #                 #
    0b00010000, 0b01000000, 0b00000000, 0b00010000, //    #     #                 #
    0b00010011, 0b11111000, 0b00111111, 0b10010000, //    #  #######     #######  #
    0b00010000, 0b01000000, 0b00000000, 0b00010000, //    #     #                 #
    0b00010000, 0b01000000, 0b00000000, 0b00010000, //    #     #                 #
    0b00010000, 0b01000000, 0b00000000, 0b00010000, //    #     #                 #
    0b00010000, 0b00000000, 0b00000000, 0b00010000, //    #                       #
    0b00011110, 0b00000000, 0b00000000, 0b11110000, //    ####                 ####
    0b00011110, 0b00000000, 0b00000000, 0b11110000, //    ####                 ####
    0b00011110, 0b00000000, 0b00000000, 0b11110000, //    ####                 ####
    0b00011111, 0b11111111, 0b11111111, 0b11110000, //    #########################
    0b00000000, 0b00000000, 0b00000000, 0b00000000, //
    0b00000000, 0b00000000, 0b00000000, 0b00000000, //
    0b00000000, 0b00000000, 0b00000000, 0b00000000, //
    0b00000000, 0b00000000, 0b00000000, 0b00000000, //
    0b00000000, 0b00000000, 0b00000000, 0b00000000, //
  ]).buffer
};

Graphics.prototype.drawStringDbl = (txt, px, py, h) => {
    let gBuffer = Graphics.createArrayBuffer(128, h, 2, {msb: true});
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
    spi.setup({mosi: 13, sck: 14});
    g = require("SSD1306").connectSPI(spi, 12, 16, draw, {height: 32});
}

function initClock() {
    I2C1.setup({scl: 5, sda: 4});
    rtc = require("DS3231").connect(I2C1, {DST: false});
}

function connectSocket() {
    net.connect({host: host, port: port}, (s, err) => {
        if (err) {
            console.log("Connection error: " + err);
            return;
        }
        console.log('Connected to socket.');
        socket = s;
    });
}

function connectWiFi() {
    console.log('Trying to connect to ' + ssid + '.');
    wifi.connect(ssid, {}, () => {
        console.log('WiFi connected.');
        connectSocket();
    });
}

function draw(text) {
    if (text) {
        g.clear();
        g.drawStringDbl(text, 12, 3, 32);
        g.flip();
    }
}

function sendCMDSocket(cmd) {
    socket.write(cmd + '\r\n');
    return socket.read(0).replace('>', '').trim();
}

function sendCMD(cmd) {
    if (socket) {
        if (!socket.conn) {
            connectSocket();
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
    if (hms) {
        draw(hms[0] + ' : ' + hms[1] + ' : ' + hms[2]);
    }
}

function showBattery() {
    g.clear();
    g.drawImage(battery, 0, 0);
    g.flip();
    //console.log(sendCMD('ATRV'));
}

E.on('init', () => {
    pinMode(2, 'input_pullup');

    setWatch(function(e) {
        if ((selectedMode + 1) === modes.length) {
            selectedMode = 0;
        } else {
            selectedMode++;
        }
        console.log(modes[selectedMode]);
    }, 2, { repeat: true, edge: 'rising', debounce: 50 });

    initDisplay();
    initClock();
    connectWiFi();

    setInterval(() => {
        switch (modes[selectedMode]) {
            case 'clock':
                showClock();
                break;
            case 'battery':
                showBattery();
                break;
        }
    }, 1);
});