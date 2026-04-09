const canvas = document.getElementById("grid");
const ctx = canvas.getContext("2d");

// SETTINGS
const rows = 25; // reduced for performance
const size = 800;
canvas.width = size;
canvas.height = size;
const cell = size / rows;

const EMPTY = 0;
const WALL = 1;
const PATH = 2;
const EXPLORED = 3;

let grid = createEmptyGrid();
let start = null;
let end = null;
let mode = "wall";

let speed = 15;
let showExploration = true;
let isRunning = false;
let runToken = 0;

// ---------------- GRID ----------------
function createEmptyGrid() {
    return Array.from({ length: rows }, () => Array(rows).fill(EMPTY));
}

function keyOf(n) {
    return `${n[0]},${n[1]}`;
}

function same(a, b) {
    return a && b && a[0] === b[0] && a[1] === b[1];
}

function inBounds(r, c) {
    return r >= 0 && c >= 0 && r < rows && c < rows;
}

// ---------------- DRAW ----------------
function draw() {
    ctx.clearRect(0, 0, size, size);

    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < rows; j++) {
            if (grid[i][j] === WALL) ctx.fillStyle = "#00ffd5";
            else if (grid[i][j] === PATH) ctx.fillStyle = "#1e90ff";
            else if (grid[i][j] === EXPLORED) ctx.fillStyle = "#ffaa00";
            else ctx.fillStyle = "#111";

            ctx.fillRect(j * cell, i * cell, cell, cell);
        }
    }

    if (start) {
        ctx.fillStyle = "green";
        ctx.fillRect(start[1]*cell, start[0]*cell, cell, cell);
    }

    if (end) {
        ctx.fillStyle = "red";
        ctx.fillRect(end[1]*cell, end[0]*cell, cell, cell);
    }
}

// ---------------- DRAWING ----------------
let isMouseDown = false;

canvas.addEventListener("mousedown", e => {
    isMouseDown = true;
    handle(e);
});

canvas.addEventListener("mouseup", () => isMouseDown = false);
canvas.addEventListener("mouseleave", () => isMouseDown = false);
canvas.addEventListener("mousemove", e => {
    if (isMouseDown) handle(e);
});

function handle(e) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / cell);
    const y = Math.floor((e.clientY - rect.top) / cell);

    if (!inBounds(y,x)) return;

    if (mode === "wall") grid[y][x] = WALL;
    if (mode === "erase") grid[y][x] = EMPTY;
    if (mode === "start") start = [y,x];
    if (mode === "end") end = [y,x];

    draw();
}

function setMode(m){ mode = m; }

// ---------------- NEIGHBORS ----------------
function neighbors([r,c]){
    return [[r+1,c],[r-1,c],[r,c+1],[r,c-1]]
        .filter(([nr,nc])=>inBounds(nr,nc)&&grid[nr][nc]!==WALL);
}

// ---------------- SEARCH RESET ----------------
function resetSearch(){
    runToken++;
    isRunning=false;

    for(let i=0;i<rows;i++){
        for(let j=0;j<rows;j++){
            if(grid[i][j]===PATH||grid[i][j]===EXPLORED){
                grid[i][j]=EMPTY;
            }
        }
    }
}

// ---------------- BFS ----------------
async function bfs(){
    if(!start || !end || isRunning) return;

    resetSearch();
    isRunning = true;
    const token = runToken;

    let q = [start];
    let visited = new Set([keyOf(start)]);
    let parent = {};

    while(q.length && token === runToken){

        // 🔥 ADD THIS LINE HERE (VERY IMPORTANT)
        if(token !== runToken){
            isRunning = false;
            return;
        }

        await sleep();

        let [r,c] = q.shift();

        if(r === end[0] && c === end[1]){
            reconstruct(parent);
            isRunning = false;
            return;
        }

        for(let n of neighbors([r,c])){
            let k = keyOf(n);

            if(!visited.has(k)){
                visited.add(k);

                // ✅ correct parent format
                parent[k] = keyOf([r,c]);

                q.push(n);

                if(!same(n,end)){
                    grid[n[0]][n[1]] = EXPLORED;
                }
            }
        }

        draw();
    }

    isRunning = false;
}

// ---------------- DFS ----------------
async function dfs(){
    if(!start || !end || isRunning) return;

    resetSearch();
    isRunning = true;
    const token = runToken;

    let stack = [start];
    let visited = new Set([keyOf(start)]);
    let parent = {};

    while(stack.length && token === runToken){

        // 🔥 STOP OLD RUNS
        if(token !== runToken){
            isRunning = false;
            return;
        }

        await sleep();

        let [r,c] = stack.pop();

        if(r === end[0] && c === end[1]){
            reconstruct(parent);
            isRunning = false;
            return;
        }

        for(let n of neighbors([r,c])){
            let k = keyOf(n);

            if(!visited.has(k)){
                visited.add(k);

                // ✅ FIX (IMPORTANT)
                parent[k] = keyOf([r,c]);

                stack.push(n);

                if(!same(n,end)){
                    grid[n[0]][n[1]] = EXPLORED;
                }
            }
        }

        draw();
    }

    isRunning = false;
}

// ---------------- A* ----------------
function heuristic(a,b){
    return Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]);
}

async function astar(){
    if(!start||!end||isRunning) return;
    resetSearch();
    isRunning=true;

    let open=[[0,start]];
    let parent={};
    let g={};
    g[keyOf(start)]=0;

    while(open.length){
        await sleep();

        open.sort((a,b)=>a[0]-b[0]);
        let current=open.shift()[1];

        if(same(current,end)){
            reconstruct(parent);
            isRunning=false;
            return;
        }

        for(let n of neighbors(current)){
            let nk=keyOf(n);
            let ck=keyOf(current);
            let newG=g[ck]+1;

            if(!(nk in g)||newG<g[nk]){
                g[nk]=newG;
                let f=newG+heuristic(n,end);
                open.push([f,n]);
                parent[nk]=keyOf(current);
                if(!same(n,end)) grid[n[0]][n[1]]=EXPLORED;
            }
        }

        draw();
    }
    isRunning=false;
}

// ---------------- PATH ----------------
function reconstruct(parent) {
    let cur = keyOf(end);

    while (parent[cur]) {
        cur = parent[cur];

        let [r, c] = cur.split(',').map(Number);

        if (!same([r, c], start)) {
            grid[r][c] = PATH;
        }
    }

    draw();
}

// ---------------- MAZE (INSANE LEVEL) ----------------
function generateMaze(){
    resetSearch();
    grid=Array.from({length:rows},()=>Array(rows).fill(WALL));

    function carve(r,c){
        const dirs=[[0,2],[0,-2],[2,0],[-2,0]]
        .sort(()=>Math.random()-0.5);

        for(let [dr,dc] of dirs){
            let nr=r+dr,nc=c+dc;

            if(inBounds(nr,nc)&&grid[nr][nc]===WALL){
                grid[r+dr/2][c+dc/2]=EMPTY;
                grid[nr][nc]=EMPTY;
                carve(nr,nc);
            }
        }
    }

    let sr=Math.floor(Math.random()*rows/2)*2;
    let sc=Math.floor(Math.random()*rows/2)*2;

    grid[sr][sc]=EMPTY;
    carve(sr,sc);

    // 🔥 MULTIPLE PATHS
    for(let i=0;i<rows*rows*0.2;i++){
        let r=Math.floor(Math.random()*rows);
        let c=Math.floor(Math.random()*rows);
        if(grid[r][c]===WALL) grid[r][c]=EMPTY;
    }

    start=randomCell();
    end=randomFar(start);

    draw();
}

// ---------------- HELPERS ----------------
function randomCell(){
    let cells=[];
    for(let i=0;i<rows;i++){
        for(let j=0;j<rows;j++){
            if(grid[i][j]===EMPTY) cells.push([i,j]);
        }
    }
    return cells[Math.floor(Math.random()*cells.length)];
}

function randomFar(s){
    let best=s;
    let max=0;

    for(let i=0;i<50;i++){
        let c=randomCell();
        let d=Math.abs(s[0]-c[0])+Math.abs(s[1]-c[1]);
        if(d>max){max=d;best=c;}
    }
    return best;
}

function sleep(){
    return new Promise(r=>setTimeout(r,speed));
}

// ---------------- RESET ----------------
function clearGrid(){
    resetSearch();
    grid=createEmptyGrid();
    start=null;
    end=null;
    draw();
}

draw();