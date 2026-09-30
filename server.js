const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));

// מפלגות לבחירה - תוקן השימוש בגרשיים
const PARTIES = ['הליכוד', 'יש עתיד', 'מחנה ממלכתי', 'ש"ס', 'ישראל ביתנו', 'עוצמה יהודית', 'יהדות התורה', 'העבודה-מרצ'];

// מצב המערכת
let gameState = {
    status: 'closed', // 'closed' | 'voting' | 'stopping'
    totalVotes: 0,
    votes: {},
    votedDevices: new Set()
};

// איפוס ספירה
PARTIES.forEach(p => gameState.votes[p] = 0);

function broadcast(data) {
    const message = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}