const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// הגשת קבצים סטטיים מתיקיית public
app.use(express.static(path.join(__dirname, 'public')));

// נתיב מפורש למנהל
app.get('/admin-control-x9z87', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// מפלגות מעודכנות ומסודרות לפי סדר אלפביתי (א'-ב')
const PARTIES = [
    'ביחד (בראשות נפתלי בנט)',
    'הדמוקרטים (בראשות יאיר גולן)',
    'הליכוד (בראשות בנימין נתניהו)',
    'המחנה הממלכתי (בראשות בני גנץ)',
    'הציונות הדתית (בראשות בצלאל סמוטריץ\')',
    'חד"ש-תע"ל (בראשות איימן עודה)',
    'יהדות התורה (בראשות יצחק גולדקנופף)',
    'ישראל ביתנו (בראשות אביגדור ליברמן)',
    'עוצמה יהודית (בראשות איתמר בן גביר)',
    'עמך ישראל (בראשות עופר וינטר)',
    'רע"ם (בראשות מנסור עבאס)',
    'ש"ס (בראשות אריה דרעי)'
];

// מצב המערכת
let gameState = {
    status: 'closed', // 'closed' | 'voting' | 'stopping'
    totalVotes: 0,
    votes: {},
    votedDevices: new Set()
};

// איפוס ספירה ראשוני
PARTIES.forEach(p => gameState.votes[p] = 0);

function broadcast(data) {
    const message = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

wss.on('connection', (ws) => {
    // שליחת מצב התחלתי
    ws.send(JSON.stringify({ 
        type: 'INIT', 
        parties: PARTIES, 
        state: { 
            status: gameState.status,
            totalVotes: gameState.totalVotes,
            votes: gameState.votes
        } 
    }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            // הצבעת תלמיד
            if (data.type === 'VOTE') {
                if (gameState.status !== 'voting') {
                    return ws.send(JSON.stringify({ type: 'ERROR', message: 'ההצבעה סגורה כעת' }));
                }
                if (gameState.votedDevices.has(data.deviceId)) {
                    return ws.send(JSON.stringify({ type: 'ERROR', message: 'מכשיר זה כבר הצביע!' }));
                }

                gameState.votedDevices.add(data.deviceId);
                gameState.votes[data.party] = (gameState.votes[data.party] || 0) + 1;
                gameState.totalVotes++;

                ws.send(JSON.stringify({ type: 'VOTE_SUCCESS', party: data.party }));

                broadcast({
                    type: 'NEW_VOTE',
                    totalVotes: gameState.totalVotes,
                    party: data.party
                });
            }

            // פקודות מנהל
            if (data.type === 'ADMIN_ACTION') {
                if (data.action === 'START') {
                    gameState.status = 'voting';
                    broadcast({ type: 'STATUS_CHANGE', status: 'voting' });
                } else if (data.action === 'STOP') {
                    gameState.status = 'stopping';
                    broadcast({ type: 'START_COUNTDOWN' });
                    
                    let timer = 10;
                    const interval = setInterval(() => {
                        timer--;
                        broadcast({ type: 'TIMER_TICK', timer });
                        if (timer <= 0) {
                            clearInterval(interval);
                            gameState.status = 'closed';
                            broadcast({ type: 'STATUS_CHANGE', status: 'closed' });
                        }
                    }, 1000);
                } else if (data.action === 'RESET') {
                    gameState.status = 'closed';
                    gameState.totalVotes = 0;
                    gameState.votedDevices.clear();
                    PARTIES.forEach(p => gameState.votes[p] = 0);
                    broadcast({ type: 'RESET_ALL', parties: PARTIES, state: gameState });
                }
            }
        } catch (e) {
            console.error('Error processing message:', e);
        }
    });
});

// הגדרת פורט ל-Render
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`Server is running successfully on port ${PORT}`);
});
