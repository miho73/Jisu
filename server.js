'use strict';

const express = require('express');
const favicon = require('serve-favicon');
const bodyParser = require('body-parser');
const app = express();
const cookieParser = require('cookie-parser');
const https = require('https');
const fs = require('fs');
const sanitizeHtml = require('sanitize-html');
const ejs = require('ejs');

app.enable('trust proxy');
app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.use(favicon(__dirname + '/resources/favicon.ico'));

const HTTP_PORT = 8888;
const HTTPS_PORT = 4444;

var tca_subjects;
var data = fs.readFileSync('./db/class.json');
if(data != undefined) {
    const classes = JSON.parse(data);
    tca_subjects = new Array(classes.length);
    for(let i=0; i<classes.length; i++) {
        tca_subjects[classes[i].uid] = {
            "name":classes[i].name,
            "code":classes[i].zoomid
        }
    }
    console.log("TCA LOADED");
}
else {
    console.log("ERROR: CANNOT LOAD TCA(CLASS) SYSTEM. FATAL ERROR");
}

function sendError(errCode, errName, res) {
    res.status(errCode).render("error.ejs", {
        errorCode: errCode,
        errorExp: errName
    });
}

app.all('*', (req, res, next) => {
    let protocol = req.headers['x-forwarded-proto'] || req.protocol;
    if (protocol == 'https') next();
    else { let from = `${protocol}://${req.hostname}${req.url}`; 
        let to = `https://${req.hostname}${req.url}`;
        res.redirect(to); 
    }
});

app.get('/images/:path', (req, res)=>{
    var id = req.cookies.SESSION;
    if(CheckIdentity(req)) {
        res.sendFile(__dirname + "/views/main/images/"+req.params.path, (err)=>{
            if(err) {
                sendError(404, 'That\'s an error', res);
            }
        });
    }
    else {
        sendError(403, 'Forbidden', res);
    }
});

app.get('/tca/:path', (req, res)=>{
    res.sendFile(__dirname + "/views/tca/"+req.params.path, (err)=>{
        if(err) {
            sendError(err.status, err.message, res);
        }
    });
});

let note;
app.post('/tca/note', (req, res)=>{
    if(req.body.cont != null) {
        note = sanitizeHtml(req.body.cont);
    }
    res.sendStatus(200);
});
app.post('/tca/noteget', (req, res)=>{
    res.send(note);
});

app.post('/tca/api/:type', (req, res)=>{
    try {
        if(req.params.type == 'timetable') {
            fs.readFile('./db/timetable.json', (err, data)=>{
                if(err) {
                    res.sendStatus(500);
                }
                else {
                    const jsn = JSON.parse(data);
                    res.set({
                        'Content-Type':'application/json',
                        'Status':'200'
                    })
                    res.send(jsn["time"]);
                }
            });
        }
        else if(req.params.type == 'sche') {
            const day = req.body.day;
            if (day < 0 || day > 6) {
                throw 'Date value out of range';
            }
            fs.readFile('./db/timetable.json', (err, data)=>{
                if(err) {
                    res.sendStatus(500);
                }
                else {
                    const jsn = JSON.parse(data);
                    res.set({
                        'Content-Type':'application/json',
                        'Status':'200'
                    });
                    res.send(jsn[day]);
                }
            });
        }
        else if(req.params.type == "subj") {
            const reqs = req.body.tt;
            const reqsr = reqs.split('.');
            let retArr = new Array(reqsr.length);
            let cnt = 0;
            reqsr.forEach(element => {
                retArr[cnt] = tca_subjects[element];
                cnt++;
            });
            res.set({
                'Content-Type':'application/json',
                'Status':'200'
            });
            res.send(retArr);
        }
        else {
            sendError(404, "Not Found");
        }
    }
    catch(err) {
        sendError(400, "Bad Request: "+err, res);
    }
});

app.get('/.well-known/pki-validation/FF7E9E9E216747760D92326A8D6D36A3.txt', (req, res) =>{
    res.sendFile(__dirname + "/cert/FF7E9E9E216747760D92326A8D6D36A3.txt", (err)=>{
        if(err) {
            sendError(404, 'That\'s an error', res);
        }
    });
});

//404 handle
app.use(function(req, res, next) {
    sendError(404, 'Not Found', res);
});
  
var options = {
    ca: fs.readFileSync('/etc/letsencrypt/live/tca.r-e.kr-0001/fullchain.pem'),
    key: fs.readFileSync('/etc/letsencrypt/live/tca.r-e.kr-0001/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/tca.r-e.kr-0001/cert.pem')
};

app.listen(HTTP_PORT);
console.log("HTTP server listening on port " + HTTP_PORT);

https.createServer(options, app).listen(HTTPS_PORT, function() {
    console.log("HTTPS server listening on port " + HTTPS_PORT);
});
