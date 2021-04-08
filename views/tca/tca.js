function timeTicker() {
    let now = new Date();
    const display = document.getElementById('time');

    let time, timetable, subject;

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

    
    setInterval(function() {
        let now = new Date();
        display.innerText = getToday(now);
        let liveptr = -1;
        const nowt = new Array(2);
        time.forEach(elem => {
            const mark = elem[0].split(':');
            nowt[0] = now.getHours();
            nowt[1] = now.getMinutes();
            if(compareTime(mark, nowt) > 0) return;
            liveptr++;
        });
        if(liveptr == timetable.length-1 && compareTime(nowt, time[timetable.length-1][1].split(':')) > 0) {
            htmlSubject.innerText = "종료";
            htmlTl.innerText = "";
        }
        else if (liveptr == -1) {
            htmlSubject.innerText = "대기중";
            htmlTl.innerText = "";
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