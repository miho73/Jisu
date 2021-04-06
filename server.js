'use strict';

const DEBUG_FLAG = true;

if(DEBUG_FLAG) {
    console.log("YOU'RE DEBUGGING NOW. ALL SECURITY FEATURES WILL BE DISABLED.");
    console.log("DEBUGGING SESSION IN HOSTING ON 8080(HTTP) and 4433(HTTPS)");
}

const express = require('express');
const favicon = require('serve-favicon');
const ejs = require('ejs')
const bodyParser = require('body-parser');
const app = express();
const cookieParser = require('cookie-parser');
const session = require('express-session');
const https = require('https');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

app.set("view engine", "ejs"); 

app.use(session({
    secret: 'sdfndojjsiodfjiojgio',
    resave: false,
    saveUninitialized:true
}));
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.use(favicon(__dirname + '/resources/favicon.ico'));
app.use('/auth', express.static('views/auth'))
app.use(cookieParser());

const HTTP_PORT = 8080;
const HTTPS_PORT = 4433;

//Init DB
let IdenDb = new sqlite3.Database('./db/iden.db', sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error(err.message);
    } else {
        console.log('Connected to the IDENTIFICATION database.');
    }
});
let DataDb = new sqlite3.Database('./db/data.db', sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error(err.message);
    } else {
        console.log('Connected to the DATA database.');
    }
});
IdenDb.serialize(()=>{
    IdenDb.each('CREATE TABLE IF NOT EXISTS iden('+
                'user_code INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,'+
                'user_id TEXT NOT NULL,'+
                'user_name TEXT NOT NULL,'+
                'user_password TEXT NOT NULL,'+
                'user_salt TEXT NOT NULL);');
});
DataDb.serialize(()=>{
    DataDb.each('CREATE TABLE IF NOT EXISTS diary('+
                'diary_code INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,'+
                'diary_date TEXT NOT NULL,'+
                'diary_content TEXT NOT NULL,'+
                'added_by INTEGER NOT NULL);');
});

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

function CheckIdentity(req) {
    if(DEBUG_FLAG) return true;
    if(req.session == undefined) return false;
    else if(req.session.user) return true;
    else return false;
}

app.get('/', (req, res)=>{
    const id = req.cookies.SESSION;
    if(CheckIdentity(req)) {
        try {
            res.render("main/index.ejs", {
                name: req.session.user.name
            });
        }
        catch {
            sendError(412, "Precondition Failed", res);
        }
    }
    else {
        res.redirect("/auth");
    }
});

app.get('/:path', (req, res)=>{
    var id = req.cookies.SESSION;
    if (req.params.path == 'auth') {
        if(CheckIdentity(req)) {
            res.redirect('/');
        }
        else {
            res.render('auth/main.ejs', {
                visible: "collapse"
            });
        }
    }
    else if (req.params.path == 'about') {
        res.render('about.ejs');
    }
    else {
        try {
            if(CheckIdentity(req)) {
                if (req.params.path == 'signup') {
                    res.render('main/signup/signup.ejs', {
                        alert: ""
                    });
                }
                else if (req.params.path == "diary") {
                    res.render('main/diary/main.ejs', {
                        random_img: "img/1.jpg"
                    });
                }
                else {
                    res.sendFile(__dirname + "/views/main/"+req.params.path, (err)=>{
                        if(err) {
                            sendError(404, 'That\'s an error', res);
                        }
                    });
                }
            }
            else {
                sendError(403, 'Forbidden', res);
            }
        }
        catch {
            sendError(404, 'Not Found');
        }
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

app.get('/auth/deauth', (req, res)=>{
    if (CheckIdentity(req)) {
        req.session.destroy(
            function (err) {
                if (err) {
                    sendError(500, 'INTERNAL SERVER ERROR', res);
                    return;
                }
            }
        );
    }
    res.redirect("/");
})

app.post('/auth', (req, res)=>{
    if(!new RegExp('^[a-zA-Z0-9]{1,50}$').test(req.body.id)) {
        res.render('./auth/main.ejs',  {
            visible: "visible"
        });
        return;
    }

    var sucess = false;
    IdenDb.all('SELECT * FROM iden WHERE user_id=?;', [req.body.u], (err, row) => {
        if(row.length == 1) {
            if(err) {
                if(!sucess) {
                    res.render('./auth/main.ejs',  {
                        visible: "visible"
                    });
                }
            }
            else {
                const buf = Buffer.from(row[0].user_salt, 'base64');
                crypto.pbkdf2(req.body.p, buf.toString('base64'), 12495, 64, 'sha512', (err, key) => {
                    if(row[0].user_password==key.toString('base64')) {
                        req.session.user = {
                            id: row[0].user_id,
                            pwd: req.body.p,
                            name: row[0].user_name,
                            auth: true
                        };
                        res.redirect("/");
                        sucess = true;
                    }
                    else {
                        if(!sucess) {
                            res.render('./auth/main.ejs',  {
                                visible: "visible"
                            });
                        }
                    }
                });
            }
        }
        else {
            res.render('./auth/main.ejs',  {
                visible: "visible"
            });
        }
    });
});

app.get('/signup/:path', (req, res)=>{
    var id = req.cookies.SESSION;
    if(CheckIdentity(req)) {
        res.sendFile(__dirname + "/views/main/signup/"+req.params.path, (err)=>{
            if(err) {
                sendError(err.status, err.message, res);
            }
        });
    }
    else {
        sendError(403, 'Forbidden', res);
    }
});

app.get('/diary/:path', (req, res)=>{
    var id = req.cookies.SESSION;
    if(CheckIdentity(req)) {
        res.sendFile(__dirname + "/views/main/diary/"+req.params.path, (err)=>{
            if(err) {
                sendError(err.status, err.message, res);
            }
        });
    }
    else {
        sendError(403, 'Forbidden', res);
    }
});

app.get('/diary/img/:path', (req, res)=>{
    var id = req.cookies.SESSION;
    if(CheckIdentity(req)) {
        res.sendFile(__dirname + "/views/main/diary/imgs/"+req.params.path, (err)=>{
            if(err) {
                sendError(err.status, err.message, res);
            }
        });
    }
    else {
        sendError(403, 'Forbidden', res);
    }
});

app.get('/utils/:path', (req, res)=>{
    if(req.url.endsWith('.css')) {
        res.sendFile(__dirname + "/views/main/utils/"+req.params.path, (err)=>{
            if(err) {
                sendError(err.status, err.message, res);
            }
        });
    }
    else if(req.params.path == "random") {
        res.render('main/utils/random.ejs', {
            from_value: 0,
            to_value: 32,
            number: 1
        });
    }
    else if(req.params.path == "colors") {
        if(req.query.color == undefined) {
            res.render('main/utils/colors.ejs', {
                color: "black"
            });
        }
        else if(new RegExp('^[#]{0,1}[a-zA-Z0-9]{1,9}$').test(req.query.color)) {
            res.render('main/utils/colors.ejs', {
                color: req.query.color
            });
        }
        else {
            res.render('main/utils/colors.ejs', {
                color: "black"
            });
        }
    }
    else {
        sendError(404, "Not Found", res);
    }
});

app.post('/util/random', (req, res)=>{
    var min = Math.ceil(req.body.from), max = Math.floor(req.body.to);
    min = Math.abs(min);
    max = Math.abs(max);
    res.render('main/utils/random.ejs', {
        from_value: min,
        to_value: max,
        number: Math.floor(Math.random() * (max - min + 1)) + min
    });
});

app.post('/signup', (req, res)=>{
    if(!CheckIdentity(req)) {
        sendError(403, "Forbidden", res);
    }
    if(!new RegExp('^[a-zA-Z0-9]{1,50}$').test(req.body.id)) {
        res.render('main/signup/signup.ejs', {
            alert: "ID Error"
        });
        return;
    }
    if(!new RegExp('^[a-zA-Z0-9]{4,50}$').test(req.body.password)) {
        res.render('main/signup/signup.ejs', {
            alert: "Password Error"
        });
        return;
    }
    if(!new RegExp('^[a-zA-Z가-힣]{1,50}$').test(req.body.name)) {
        res.render('main/signup/signup.ejs', {
            alert: "Name Error"
        });
        return;
    }
    crypto.randomBytes(64, (err, buf) => {
        crypto.pbkdf2(req.body.password, buf.toString('base64'), 12495, 64, 'sha512', (err, key) => {
        IdenDb.run(`INSERT INTO iden(user_id, user_name, user_password, user_salt) `+
                   `values (?, ?, ?, ?)`,
                   [req.body.id, req.body.name, key.toString('base64'), buf.toString('base64')]);
        });
    });
    res.redirect('/');
});

app.post('/diary', (req, res)=>{
    if(!CheckIdentity(req)) {
        sendError(403, "Forbidden", res);
        return;
    }
    let now = new Date();
    var nonquery = DataDb.prepare('INSERT INTO Diary(diary_date, diary_content, added_by) VALUES (?, ?, ?);');
    nonquery.run([
        now.getFullYear()+"-"+("0" + (now.getMonth() + 1)).slice(-2)+"-"+("0" + now.getDate()).slice(-2)+
        "T"+("0" + now.getHours()).slice(-2)+":"+("0" + now.getMinutes()).slice(-2)+":"+("0" + now.getSeconds()).slice(-2)+
        (now.getTimezoneOffset()-now.getTimezoneOffset()%60)/60+":"+("0" + now.getTimezoneOffset()%60).slice(-2)+"Z",
        req.body.today,
        req.session.user.id
    ], function(error) {
        res.render("main/diary/done.ejs", {
            random_img: "img/1.jpg"
        });
    });
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
    key: fs.readFileSync('./cert/private.key'),
    cert: fs.readFileSync('./cert/certificate.crt')
};

app.listen(HTTP_PORT);
console.log("HTTP server listening on port " + HTTP_PORT);

https.createServer(options, app).listen(HTTPS_PORT, function() {
    console.log("HTTPS server listening on port " + HTTPS_PORT);
});
