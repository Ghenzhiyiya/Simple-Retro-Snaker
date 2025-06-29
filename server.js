const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

// 游戏状态
let players = {};
let foods = [];
const GRID_SIZE = 20;
const CANVAS_SIZE = 400;

// 生成食物
function generateFood() {
    return {
        x: Math.floor(Math.random() * GRID_SIZE) * (CANVAS_SIZE / GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE) * (CANVAS_SIZE / GRID_SIZE)
    };
}

// 初始化食物
for (let i = 0; i < 5; i++) {
    foods.push(generateFood());
}

io.on('connection', (socket) => {
    console.log('用户连接');

    // 玩家加入
    socket.on('join', (data) => {
        players[socket.id] = {
            x: Math.floor(Math.random() * GRID_SIZE) * (CANVAS_SIZE / GRID_SIZE),
            y: Math.floor(Math.random() * GRID_SIZE) * (CANVAS_SIZE / GRID_SIZE),
            direction: 'right',
            score: 0,
            segments: []
        };
        // 初始化蛇身
        for (let i = 0; i < 3; i++) {
            players[socket.id].segments.push({
                x: players[socket.id].x - (i * (CANVAS_SIZE / GRID_SIZE)),
                y: players[socket.id].y
            });
        }
    });

    // 更新方向
    socket.on('direction', (direction) => {
        if (players[socket.id]) {
            players[socket.id].direction = direction;
        }
    });

    // 断开连接
    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('players', players);
    });
});

// 游戏循环
setInterval(() => {
    // 更新所有玩家位置
    for (let id in players) {
        let player = players[id];
        let head = {x: player.segments[0].x, y: player.segments[0].y};

        // 根据方向移动
        switch (player.direction) {
            case 'up':
                head.y -= CANVAS_SIZE / GRID_SIZE;
                break;
            case 'down':
                head.y += CANVAS_SIZE / GRID_SIZE;
                break;
            case 'left':
                head.x -= CANVAS_SIZE / GRID_SIZE;
                break;
            case 'right':
                head.x += CANVAS_SIZE / GRID_SIZE;
                break;
        }

        // 边界检查
        if (head.x >= CANVAS_SIZE) head.x = 0;
        if (head.x < 0) head.x = CANVAS_SIZE - CANVAS_SIZE / GRID_SIZE;
        if (head.y >= CANVAS_SIZE) head.y = 0;
        if (head.y < 0) head.y = CANVAS_SIZE - CANVAS_SIZE / GRID_SIZE;

        // 检查碰撞
        let collision = false;
        
        // 检查与其他玩家的碰撞
        for (let otherId in players) {
            if (otherId === id) continue;
            const otherPlayer = players[otherId];
            for (let segment of otherPlayer.segments) {
                if (head.x === segment.x && head.y === segment.y) {
                    collision = true;
                    break;
                }
            }
        }

        // 检查自身碰撞
        for (let i = 1; i < player.segments.length; i++) {
            if (head.x === player.segments[i].x && head.y === player.segments[i].y) {
                collision = true;
                break;
            }
        }

        if (collision) {
            // 碰撞惩罚：减少分数和长度
            player.score = Math.max(0, player.score - 20);
            if (player.segments.length > 3) {
                player.segments = player.segments.slice(0, player.segments.length - 2);
            }
            // 随机改变方向
            const directions = ['up', 'down', 'left', 'right'];
            player.direction = directions[Math.floor(Math.random() * directions.length)];
        } else {
            // 检查是否吃到食物
            foods.forEach((food, index) => {
                if (head.x === food.x && head.y === food.y) {
                    player.score += 10;
                    foods[index] = generateFood();
                    player.segments.push({...player.segments[player.segments.length - 1]});
                }
            });
        }

        // 更新蛇身
        player.segments.unshift(head);
        player.segments.pop();
    }

    // 发送游戏状态
    io.emit('gameState', { players, foods });
}, 100);

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
});