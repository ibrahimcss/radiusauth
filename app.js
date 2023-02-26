const express = require('express');
const bodyParser = require('body-parser');
const radius = require('radius');

const app = express();

const options = {
    host: 'your-radius-server',
    port: 1812,
    secret: 'your-shared-secret',
    family: 'udp4'
};


const authenticateUser = (username, password, birthdate, roomNumber) => {
    return new Promise((resolve, reject) => {
        const attributes = {
            'User-Name': username,
            'User-Password': password,
            'Birthdate': birthdate,
            'Room-Number': roomNumber
        };
        const packet = {
            code: 'Access-Request',
            secret: options.secret,
            attributes: radius.add_message_authenticator(attributes)
        };
        const client = radius.Request(options);
        client.send(packet, options.host, (err, response) => {
            if (err) {
                reject(err);
            } else if (response.code === 'Access-Accept') {
                resolve();
            } else {
                reject();
            }
        });
    });
};
const createRadiusResponse = (username, success, nasIpAddress, ipAddress, macAddress) => {
    const attributes = {
        'User-Name': username,
        'NAS-IP-Address': nasIpAddress,
        'Framed-IP-Address': ipAddress,
        'Calling-Station-Id': macAddress
    };
    const code = success ? 'Access-Accept' : 'Access-Reject';
    return radius.encode_response({
        code: code,
        attributes: attributes,
        secret: options.secret
    });
};

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.post('/login', (req, res) => {
    const { username, password, birthdate, roomNumber } = req.body;
    const nasIpAddress = req.ip; // kullanıcının IP adresi
    const macAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress; // kullanıcının MAC adresi
    authenticateUser(username, password, birthdate, roomNumber)
        .then(() => {
            const responsePacket = createRadiusResponse(username, true, nasIpAddress, req.ip, macAddress);
            res.set('Content-Type', 'application/octet-stream');
            res.send(responsePacket);
        })
        .catch(() => {
            const responsePacket = createRadiusResponse(username, false, nasIpAddress, req.ip, macAddress);
            res.set('Content-Type', 'application/octet-stream');
            res.status(401).send(responsePacket);
        });
});

app.listen(3000, () => {
    console.log('Uygulama çalışıyor...');
});