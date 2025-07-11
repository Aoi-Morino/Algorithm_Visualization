document.addEventListener('DOMContentLoaded', () => {
    // --- DOM要素の取得 ---
    const controls = {
        arraySizeInput: document.getElementById('array-size'),
        resetBtn: document.getElementById('reset-btn'),
        startStopBtn: document.getElementById('start-stop-btn'),
        speedSlider: document.getElementById('speed-slider'),
        speedInput: document.getElementById('speed-input'),
    };
    const gridContainer = document.querySelector('.grid-container');

    // --- 状態管理 ---
    let state = {
        arraySize: 50,
        masterArray: [],
        dataType: 'shuffled_unique',
        maxValue: 50,
        isSorting: false,
        isPaused: false,
        sortAreas: [],
        speedOpsPerSec: 50,
        mainLoopIntervalId: null,
        availableAlgorithms: {
            'bubbleSort': { name: 'バブルソート', func: bubbleSort },
            'shakerSort': { name: 'シェイカーソート', func: shakerSort },
            'selectionSort': { name: '選択ソート', func: selectionSort },
            'insertionSort': { name: '挿入ソート', func: insertionSort },
            'shellSort': { name: 'シェルソート', func: shellSort },
            'quickSort': { name: 'クイックソート', func: quickSort },
            'mergeSort': { name: 'マージソート', func: mergeSort },
            'beadSort': { name: 'ビーズソート', func: beadSort },
            'bogoSort': { name: 'ボゴソート', func: bogoSort },
            'bozoSort': { name: 'ボゾソート', func: bozoSort },
        },
    };

    // --- 初期化 ---
    function initialize() {
        const initialAlgorithms = ['bubbleSort', 'shakerSort', 'quickSort', 'mergeSort'];
        for (let i = 0; i < 4; i++) {
            createSortArea(i, initialAlgorithms[i]);
        }
        addEventListeners();
        updateSpeed(parseInt(controls.speedSlider.value, 10));
        handleReset();
    }
    
    // --- ソートエリア生成 ---
    function createSortArea(id, algoKey) {
        const areaEl = document.createElement('div');
        areaEl.className = 'sort-area';
        areaEl.id = `area-${id}`;
        areaEl.innerHTML = `
            <div class="area-header">
                <h2 id="title-${id}"></h2>
                <select class="algo-select" data-id="${id}"></select>
                <label class="enable-toggle">
                    <input type="checkbox" data-id="${id}" checked> 実行
                </label>
            </div>
            <div class="chart-container" id="chart-${id}"></div>
            <div class="counter-container">
                <span>操作回数: </span>
                <span class="counter" id="counter-${id}">0</span>
            </div>
        `;
        const selectEl = areaEl.querySelector('.algo-select');
        for (const key in state.availableAlgorithms) {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = state.availableAlgorithms[key].name;
            selectEl.appendChild(option);
        }
        selectEl.value = algoKey;
        gridContainer.appendChild(areaEl);

        state.sortAreas[id] = {
            id: id,
            algoKey: algoKey,
            runningAlgoKey: algoKey,
            data: [],
            isSorted: false,
            isEnabled: true,
            enabledAtPause: false,
            generator: null,
            stepCount: 0,
            dom: {
                area: areaEl,
                title: areaEl.querySelector(`#title-${id}`),
                select: selectEl,
                checkbox: areaEl.querySelector('input[type="checkbox"]'),
                chart: areaEl.querySelector(`#chart-${id}`),
                counter: areaEl.querySelector(`#counter-${id}`),
            }
        };
    }

    // --- イベントリスナー ---
    function addEventListeners() {
        controls.resetBtn.addEventListener('click', handleReset);
        controls.startStopBtn.addEventListener('click', handleStartStopToggle);
        
        controls.speedSlider.addEventListener('input', (e) => updateSpeed(parseInt(e.target.value, 10)));
        controls.speedInput.addEventListener('input', (e) => {
            let value = parseInt(e.target.value, 10);
            if (isNaN(value)) return;
            value = Math.max(1, Math.min(100, value));
            updateSpeed(value, true);
        });
        
        state.sortAreas.forEach(area => {
            area.dom.select.addEventListener('change', handleAlgoChange);
            area.dom.checkbox.addEventListener('change', () => handleToggleEnable(area));
        });
    }

    // --- 速度更新関数 ---
    function updateSpeed(speed, fromInput = false) {
        state.speedOpsPerSec = speed;
        controls.speedInput.value = speed;
        if (!fromInput) {
            controls.speedSlider.value = speed;
        }
        if (state.isSorting && !state.isPaused) {
            startMainLoop();
        }
    }
    
    // --- UI状態更新 ---
    function updateControlsState() {
        const isRunning = state.isSorting && !state.isPaused;
        
        controls.startStopBtn.textContent = isRunning ? '停止' : '実行';
        controls.startStopBtn.classList.toggle('sorting', isRunning);

        controls.resetBtn.disabled = isRunning;
        
        controls.arraySizeInput.disabled = isRunning;
        document.querySelectorAll('input[name="dataType"]').forEach(radio => radio.disabled = isRunning);
        
        state.sortAreas.forEach(area => {
            area.dom.select.disabled = isRunning;

            if (isRunning) {
                area.dom.checkbox.disabled = true;
            } else if (state.isPaused) {
                area.dom.checkbox.disabled = !area.enabledAtPause;
            } else {
                area.dom.checkbox.disabled = false;
            }
        });
        
        controls.speedSlider.disabled = false;
        controls.speedInput.disabled = false;
    }

    // --- イベントハンドラ ---
    function handleReset() {
        state.isSorting = false;
        state.isPaused = false;
        stopMainLoop();
        
        state.arraySize = parseInt(controls.arraySizeInput.value) || 50;
        state.arraySize = Math.max(5, Math.min(100, state.arraySize));
        controls.arraySizeInput.value = state.arraySize;
        state.dataType = document.querySelector('input[name="dataType"]:checked').value;
        
        state.sortAreas.forEach(area => {
            area.algoKey = area.dom.select.value;
        });

        switch (state.dataType) {
            case 'random_duplicate':
                state.masterArray = generateRandomDuplicateArray(state.arraySize);
                state.maxValue = 100;
                break;
            case 'shuffled_unique':
            default:
                state.masterArray = generateShuffledUniqueArray(state.arraySize);
                state.maxValue = state.arraySize;
                break;
        }

        state.sortAreas.forEach(area => {
            area.runningAlgoKey = area.algoKey;
            area.data = [...state.masterArray];
            area.isSorted = false;
            area.generator = null;
            area.stepCount = 0;
            area.dom.chart.classList.remove('sorted', 'timeout');
            area.isEnabled = area.dom.checkbox.checked;
            area.dom.chart.classList.toggle('disabled', !area.isEnabled);
            
            updateTitle(area);
            drawChart(area.id);
            area.dom.counter.textContent = '0';
        });
        updateControlsState();
    }
    
    function handleStartStopToggle() {
        if (state.isSorting && !state.isPaused) {
            state.isPaused = true;
            stopMainLoop();
            state.sortAreas.forEach(area => {
                area.enabledAtPause = area.isEnabled;
            });
        } else {
            if (state.isPaused) {
                state.isSorting = true;
                state.isPaused = false;
                startMainLoop();
            } else {
                const shouldRestart = state.sortAreas.some(area => area.isSorted || area.dom.chart.classList.contains('timeout'));
                if (shouldRestart) {
                    state.sortAreas.forEach(area => {
                        area.algoKey = area.dom.select.value;
                    });
                }
                
                state.sortAreas.forEach(area => {
                    area.runningAlgoKey = area.algoKey;
                    updateTitle(area);
                    if (shouldRestart && area.isEnabled) {
                        area.isSorted = false;
                        area.generator = null;
                        area.data = [...state.masterArray];
                        area.stepCount = 0;
                        area.dom.chart.classList.remove('sorted', 'timeout');
                        drawChart(area.id);
                        area.dom.counter.textContent = '0';
                    }
                });

                state.isSorting = true;
                state.isPaused = false;
                startMainLoop();
            }
        }
        updateControlsState();
    }

    function handleAlgoChange(e) {
        const area = state.sortAreas[e.target.dataset.id];
        area.algoKey = e.target.value;
    }

    function handleToggleEnable(area) {
        area.isEnabled = area.dom.checkbox.checked;
        area.dom.chart.classList.toggle('disabled', !area.isEnabled);
        
        if (state.isPaused && !area.isEnabled) {
            area.generator = null;
        }
    }
    
    // --- メインループ制御 ---
    function startMainLoop() {
        stopMainLoop();
        const intervalTime = 1000 / state.speedOpsPerSec;
        state.mainLoopIntervalId = setInterval(runSorters, intervalTime);
    }

    function stopMainLoop() {
        if (state.mainLoopIntervalId) {
            clearInterval(state.mainLoopIntervalId);
            state.mainLoopIntervalId = null;
        }
    }

    // --- メイン実行ロジック (修正箇所) ---
    function runSorters() {
        let allDone = true;
        for (const area of state.sortAreas) {
            if (!area.isEnabled || area.isSorted || area.dom.chart.classList.contains('timeout')) {
                continue;
            }
            if (!area.generator) {
                area.generator = state.availableAlgorithms[area.runningAlgoKey].func(area.id);
            }
            
            allDone = false;
            
            // ★★★ 修正点: 最大試行回数を10,000に変更 ★★★
            const isTimeoutAlgo = area.runningAlgoKey === 'bogoSort' || area.runningAlgoKey === 'bozoSort';
            if (isTimeoutAlgo && area.stepCount > 10000) {
                area.dom.counter.textContent = "TIMEOUT";
                area.dom.chart.classList.add('timeout');
                area.generator = null;
                continue;
            }

            const result = area.generator.next();
            area.stepCount++;
            area.dom.counter.textContent = area.stepCount.toLocaleString();
            
            if (result.value) {
                const { action, areaId, highlights } = result.value;
                if (action === 'draw') drawChart(areaId, highlights);
            }
            if (result.done) {
                area.isSorted = true;
                area.generator = null;
                area.dom.chart.classList.add('sorted');
                drawChart(area.id);
            }
        }

        if (allDone) {
            stopMainLoop();
            state.isSorting = false;
            state.isPaused = false;
            updateControlsState();
        }
    }
    
    function generateShuffledUniqueArray(size) {
        const arr = Array.from({ length: size }, (_, i) => i + 1);
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
    
    function generateRandomDuplicateArray(size) {
        const arr = [];
        for (let i = 0; i < size; i++) {
            arr.push(Math.floor(Math.random() * 100) + 1); 
        }
        return arr;
    }
    
    function drawChart(areaId, highlights = {}) {
        const area = state.sortAreas[areaId];
        const chart = area.dom.chart;
        chart.innerHTML = '';
        const maxValue = state.maxValue;
        area.data.forEach((value, index) => {
            const bar = document.createElement('div');
            bar.className = 'bar';
            bar.style.height = `${(value / maxValue) * 100}%`;
            if (highlights[index]) bar.classList.add(highlights[index]);
            chart.appendChild(bar);
        });
    }

    function updateTitle(area) {
        area.dom.title.textContent = state.availableAlgorithms[area.runningAlgoKey].name;
    }

    // --- ソートアルゴリズム (変更なし) ---
    function* bubbleSort(areaId){const area=state.sortAreas[areaId],arr=area.data,n=arr.length;for(let i=0;i<n-1;i++)for(let j=0;j<n-i-1;j++)if(yield{action:"draw",areaId:areaId,highlights:{[j]:"compare",[j+1]:"compare"}},arr[j]>arr[j+1])arr[j]=[arr[j+1],arr[j+1]=arr[j]][0],yield{action:"draw",areaId:areaId,highlights:{[j]:"swap",[j+1]:"swap"}}}
    function* shakerSort(areaId){const area=state.sortAreas[areaId],arr=area.data;let left=0,right=arr.length-1,swapped=!0;for(;swapped;){swapped=!1;for(let i=left;i<right;i++)if(yield{action:"draw",areaId:areaId,highlights:{[i]:"compare",[i+1]:"compare"}},arr[i]>arr[i+1])arr[i]=[arr[i+1],arr[i+1]=arr[i]][0],swapped=!0,yield{action:"draw",areaId:areaId,highlights:{[i]:"swap",[i+1]:"swap"}};if(right--,!swapped)break;swapped=!1;for(let i=right;i>left;i--)if(yield{action:"draw",areaId:areaId,highlights:{[i]:"compare",[i-1]:"compare"}},arr[i]<arr[i-1])arr[i]=[arr[i-1],arr[i-1]=arr[i]][0],swapped=!0,yield{action:"draw",areaId:areaId,highlights:{[i]:"swap",[i-1]:"swap"}};left++}}
    function* selectionSort(areaId){const area=state.sortAreas[areaId],arr=area.data,n=arr.length;for(let i=0;i<n-1;i++){let min_idx=i;for(let j=i+1;j<n;j++)yield{action:"draw",areaId:areaId,highlights:{[min_idx]:"pivot",[j]:"compare"}},arr[j]<arr[min_idx]&&(min_idx=j);arr[i]=[arr[min_idx],arr[min_idx]=arr[i]][0],yield{action:"draw",areaId:areaId,highlights:{[i]:"swap",[min_idx]:"swap"}}}}
    function* insertionSort(areaId){const area=state.sortAreas[areaId],arr=area.data,n=arr.length;for(let i=1;i<n;i++){let key=arr[i],j=i-1;for(yield{action:"draw",areaId:areaId,highlights:{[i]:"pivot"}};j>=0&&arr[j]>key;)arr[j+1]=arr[j],yield{action:"draw",areaId:areaId,highlights:{[j]:"compare",[j+1]:"swap"}},j=j-1;arr[j+1]=key,yield{action:"draw",areaId:areaId,highlights:{[j+1]:"swap"}}}}
    function* shellSort(areaId){const area=state.sortAreas[areaId],arr=area.data,n=arr.length;for(let gap=Math.floor(n/2);gap>0;gap=Math.floor(gap/2))for(let i=gap;i<n;i+=1){let temp=arr[i],j;for(j=i;j>=gap&&arr[j-gap]>temp;j-=gap)yield{action:"draw",areaId:areaId,highlights:{[j]:"compare",[j-gap]:"compare"}},arr[j]=arr[j-gap],yield{action:"draw",areaId:areaId,highlights:{[j]:"swap"}};arr[j]=temp,yield{action:"draw",areaId:areaId,highlights:{[j]:"swap"}}}}
    function* quickSort(areaId){const arr=state.sortAreas[areaId].data;function*partition(low,high){const pivot=arr[high];let i=low-1;yield{action:"draw",areaId:areaId,highlights:{[high]:"pivot"}};for(let j=low;j<high;j++)if(yield{action:"draw",areaId:areaId,highlights:{[high]:"pivot",[j]:"compare"}},arr[j]<pivot)i++,arr[i]=[arr[j],arr[j]=arr[i]][0],yield{action:"draw",areaId:areaId,highlights:{[high]:"pivot",[i]:"swap",[j]:"swap"}};return arr[i+1]=[arr[high],arr[high]=arr[i+1]][0],yield{action:"draw",areaId:areaId,highlights:{[i+1]:"swap"}},i+1}function*qSort(low,high){if(low<high){const p=yield*partition(low,high);yield*qSort(low,p-1),yield*qSort(p+1,high)}}yield*qSort(0,arr.length-1)}
    function* mergeSort(areaId){const arr=state.sortAreas[areaId].data;function*merge(l,m,r){const n1=m-l+1,n2=r-m,L=arr.slice(l,l+n1),R=arr.slice(m+1,m+1+n2);let i=0,j=0,k=l;for(;i<n1&&j<n2;){const highlights={};for(let h=l;h<=r;h++)highlights[h]="compare";yield{action:"draw",areaId:areaId,highlights:{...highlights,[l+i]:"pivot",[m+1+j]:"pivot"}},L[i]<=R[j]?(arr[k]=L[i],i++):(arr[k]=R[j],j++),yield{action:"draw",areaId:areaId,highlights:{...highlights,[k]:"swap"}},k++}for(;i<n1;)arr[k]=L[i],yield{action:"draw",areaId:areaId,highlights:{[k]:"swap"}},i++,k++;for(;j<n2;)arr[k]=R[j],yield{action:"draw",areaId:areaId,highlights:{[k]:"swap"}},j++,k++}function*mSort(l,r){if(!(l>=r)){const m=l+Math.floor((r-l)/2);yield*mSort(l,m),yield*mSort(m+1,r),yield*merge(l,m,r)}}yield*mSort(0,arr.length-1)}
    function* beadSort(areaId){const area=state.sortAreas[areaId],arr=area.data,max=Math.max(...arr);let beads=[];for(let i=0;i<arr.length;i++){beads[i]=new Array(max).fill(0);for(let j=0;j<arr[i];j++)beads[i][j]=1}for(let j=0;j<max;j++){let sum=0;for(let i=0;i<arr.length;i++)sum+=beads[i][j],beads[i][j]=0;for(let i=arr.length-1;i>=arr.length-sum;i--)beads[i][j]=1}for(let i=0;i<arr.length;i++){let sum=0;for(let j=0;j<max;j++)sum+=beads[i][j];if(arr[i]!==sum)arr[i]=sum,yield{action:"draw",areaId:areaId,highlights:{[i]:"swap"}}}}
    function* bogoSort(areaId){const area=state.sortAreas[areaId],arr=area.data;const isSorted=a=>{for(let i=0;i<a.length-1;i++)if(a[i]>a[i+1])return!1;return!0},shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));a[i]=[a[j],a[j]=a[i]][0]}};for(;!isSorted(arr);)shuffle(arr),yield{action:"draw",areaId:areaId,highlights:{}}}
    function* bozoSort(areaId){const area=state.sortAreas[areaId],arr=area.data,n=arr.length,isSorted=a=>{for(let i=0;i<n-1;i++)if(a[i]>a[i+1])return!1;return!0};for(;!isSorted(arr);){const i=Math.floor(Math.random()*n),j=Math.floor(Math.random()*n);arr[i]=[arr[j],arr[j]=arr[i]][0],yield{action:"draw",areaId:areaId,highlights:{[i]:"swap",[j]:"swap"}}}}

    // --- アプリケーション開始 ---
    initialize();
});
