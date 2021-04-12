let time, timetable, subject;

function setIntervalAndExecute(fn, t) {
    fn();
    return(setInterval(fn, t));
}

function timeTicker() {
    let now = new Date();
    const display = document.getElementById('time');

    //Load time interval
    $.ajax({
        'url':'/tca/api/timetable',
        'type':'POST',
        'async':false,
        'dataType':'json',
        'success': function(data) {
            time = data;
        },
        'error': function(data) {
            display.innerText = "ERROR: FIRST LOAD";
        }
    });
    //Load time table
    $.ajax({
        'url':'/tca/api/sche',
        'type':'POST',
        'async':false,
        'data':{'day':now.getDay()},
        'dataType':'json',
        'success': function(data) {
            timetable = data;
        },
        'error': function(data) {
            display.innerText = "ERROR: FIRST LOAD";
        }
    });
    //Load subject data
    $.ajax({
        'url':'/tca/api/subj',
        'type':'POST',
        'async':false,
        'data':{'tt': timetable.join('.')},
        'dataType':'json',
        'success': function(data) {
            subject = data;
        },
        'error': function(data) {
            display.innerText = "ERROR: FIRST LOAD";
        }
    });

    //Set Timetable line
    let ttline = "";
    subject.forEach(elem => {
        ttline += (elem.name+" > ");
    });
    document.getElementById("timetable").innerText = ttline;

    const htmlSubject = document.getElementById('subject');
    const htmlTl = document.getElementById('timepm');
    const current = document.getElementById('current');
    const next = document.getElementById('next');
    const btns = document.getElementById('btnContainer');
    
    let histliveptr = -2;
    setIntervalAndExecute(function() {
        let now = new Date();
        let liveptr = -1;
        display.innerText = getToday(now);
        const nowt = new Array(2);
        time.forEach(elem => {
            const mark = elem[0].split(':');
            nowt[0] = now.getHours();
            nowt[1] = now.getMinutes();
            if(compareTime(mark, nowt) > 0) return;
            liveptr++;
        });
        if(liveptr == timetable.length-1 && compareTime(nowt, time[timetable.length-1][1].split(':')) >= 0) {
            htmlSubject.innerText = "종료";
            htmlTl.innerText = "";
            btns.style.display = "none";
            liveptr_upload = timetable.length;
            return;
        }
        else if (liveptr == -1) {
            htmlSubject.innerText = "대기중";
            htmlTl.innerText = "";
            btns.style.display = "block";
            current.style.display = "none";
            next.innerText = subject[liveptr+1].name;
            liveptr_upload = -1;
            return;
        }
        else {
            let t1 = new Array(3), t2 = new Array(3);
            t1[0] = now.getHours();
            t1[1] = now.getMinutes();
            t1[2] = now.getSeconds();
            const tmpT = time[liveptr][1].split(':');
            t2[0] = tmpT[0];
            t2[1] = tmpT[1];
            t2[2] = 0;
            const timeRemain = getDiff(t1, t2);
            const timeRemainStr = new Array(3);
            timeRemainStr[0] = timeRemain[0].toString().padStart(2, '0');
            timeRemainStr[1] = timeRemain[1].toString().padStart(2, '0');
            timeRemainStr[2] = timeRemain[2].toString().padStart(2, '0');
            htmlTl.innerText = timeRemainStr.join(':');

            if(histliveptr == liveptr) return;
            btns.style.display = "block";
            current.style.display = "inline";
            histliveptr = liveptr;
            htmlSubject.innerText = subject[liveptr].name;
            htmlTl.innerText = "";
            current.innerText = subject[liveptr].name;
            if(liveptr+1 < timetable.length) {
                next.innerText = subject[liveptr+1].name;
            }
            liveptr_upload = liveptr;
        }
    }, 1000);
}

const weekday=new Array(7);
weekday[0]="일요일";
weekday[1]="월요일";
weekday[2]="화요일";
weekday[3]="수요일";
weekday[4]="목요일";
weekday[5]="금요일";
weekday[6]="토요일";

var liveptr_upload;

function getToday(date) {
    const year = date.getFullYear();
    const month = ("0" + (1 + date.getMonth())).slice(-2);
    const day = ("0" + date.getDate()).slice(-2);
    const hour = ("0" + date.getHours()).slice(-2);
    const min = ("0" + date.getMinutes()).slice(-2);
    const sec = ("0" + date.getSeconds()).slice(-2);
    const dayof = date.getDay();

    return year + "/" + month + "/" + day + " " + hour + ":"+min+":"+sec +" "+weekday[dayof];
}

/**
 * compare parameter and compare them
 * if return positive, t2->t1
 * if return 0, t1=t2
 * if return negative, t1->t2
 */
function compareTime(t1, t2) {
    if(t1[0] < t2[0]) {
        return -1;
    }
    else if(t1[0] > t2[0]) {
        return 1;
    }
    else {
        if(t1[1] < t2[1]) {
            return -1;
        }
        else if(t1[1] > t2[1]) {
            return 1;
        }
        else return 0;
    }
}

/**
 * Gets the interval of two times
 * @param {(hour, min, second)} t1 first time
 * @param {(hour, min, second)} t2 second time
 * @return returns interval of two times in (hour, min, second)
 */
function getDiff(t1, t2) {
    const t1_sec = t1[0]*3600 + t1[1]*60 + t1[2];
    const t2_sec = t2[0]*3600 + t2[1]*60 + t2[2];
    const diff = Math.abs(t1_sec-t2_sec);
    let retArr = new Array(3);
    retArr[0] = (diff - diff % 3600)/3600;
    retArr[1] = (diff - diff % 60)/60;
    retArr[2] = diff % 60;
    return retArr;
}

function addressPreprocessor(lnk) {
    if(lnk.startsWith('http')) {
        window.open(lnk);
        return true;
    }
}

function copyCurrent() {
    const lnk = subject[liveptr_upload].code;
    if(addressPreprocessor(lnk)) return;
    navigator.permissions.query({name: "clipboard-write"}).then(result => {
        if (result.state == "granted" || result.state == "prompt") {
            navigator.clipboard.writeText(lnk).then(function() {
                
            }, function() {
                alert("Clipboard failed");
            });
        }
    });
}
function copyNext() {
    const lnk = subject[liveptr_upload+1].code;
    if(addressPreprocessor(lnk)) return;
    navigator.permissions.query({name: "clipboard-write"}).then(result => {
        if (result.state == "granted" || result.state == "prompt") {
            navigator.clipboard.writeText(lnk).then(function() {
                
            }, function() {
                alert("Clipboard failed");
            });
        }
    });
}

function jojong() {
    addressPreprocessor("https://zoom.us/j/5391911505?pwd=Mmd5VDF6bW5ZanFhMVB2OGhoNGlwdz09");
}
function attendance() {
    if(localStorage.getItem('name') == undefined) {
        changeName();
    }
    else {
        navigator.permissions.query({name: "clipboard-write"}).then(result => {
            if (result.state == "granted" || result.state == "prompt") {
                navigator.clipboard.writeText(localStorage.getItem('name')+" 출석").then(function() {
                    
                }, function() {
                    alert("Clipboard failed");
                });
            }
        });
    }
}
function changeName() {
    let current = localStorage.getItem('name');
    let name = prompt(`학번과 이름을 입력해주세요.\n${current == undefined ? `"<학번 이름>출석"이 복사됩니다.` : `지금은 "${current} 출석"이 복사됩니다.`}`, "20731 현창운");
    if(name == undefined) return;
    localStorage.setItem('name', name);
}