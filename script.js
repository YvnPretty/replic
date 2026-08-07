Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(5, 11, 20, 0.95)';
Chart.defaults.plugins.tooltip.borderColor = '#1e293b';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.padding = 12;

const colors = {
    primary: 'rgba(56, 189, 248, 0.85)',
    primaryHover: 'rgba(56, 189, 248, 1)',
    alert: 'rgba(244, 63, 94, 0.85)',
    alertHover: 'rgba(244, 63, 94, 1)',
    secondary: 'rgba(167, 139, 250, 0.85)',
    secondaryHover: 'rgba(167, 139, 250, 1)',
};

// Database for Countries
const countryData = {
    mexico: {
        labels: ['Enf. Corazón', 'Diabetes', 'Tumores', 'Enf. Hígado', 'Accidentes', 'Neumonía', 'Enf. Cerebrovasculares', 'Homicidios', 'EPOC', 'Insuf. Renal'],
        data: [177673, 106874, 92006, 38179, 38166, 34779, 32760, 27989, 18427, 16678],
        colors: [colors.primary, colors.primary, colors.primary, colors.primary, colors.primary, colors.primary, colors.primary, colors.alert, colors.primary, colors.primary],
        kpiCause: 'Enf. Corazón',
        kpiVolume: 177673,
        kpiPrefix: '',
        kpiRisk: '29,000 Homicidios (Se mantiene Top 8)'
    },
    usa: {
        labels: ['Enf. Corazón', 'Cáncer', 'Accidentes', 'Derrames', 'Enf. Respiratorias', 'Alzheimer', 'Diabetes', 'Enf. Renales', 'Cirrosis', 'Suicidio'],
        data: [683037, 619812, 196488, 166783, 145612, 116016, 94382, 55070, 52259, 48683],
        colors: Array(10).fill(colors.primary),
        kpiCause: 'Enf. Corazón',
        kpiVolume: 683037,
        kpiPrefix: '',
        kpiRisk: 'Suicidio reingresa al Top 10'
    },
    venezuela: {
        labels: ['Enf. Cardiovasculares', 'Cáncer', 'Diabetes', 'Enf. Respiratorias', 'Causas Externas', 'Enf. Digestivas', 'Enf. Infecciosas', 'Enf. Genitourinarias', 'Cond. Maternas', 'Deficiencias Nutricionales'],
        data: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1], // Inverted rank
        colors: Array(10).fill(colors.secondary),
        kpiCause: 'Enf. Cardiovasculares',
        kpiVolume: 10,
        kpiPrefix: 'Puntaje de Ranking: ',
        kpiRisk: 'Altas cifras por causas externas y deficiencias',
        isRank: true
    },
    peru: {
        labels: ['COVID-19', 'Inf. Respiratorias', 'Cardiopatía Isquémica', 'Derrame Cerebral', 'Enf. Renales', 'Cirrosis', 'Cáncer Estómago', 'Diabetes', 'Tuberculosis', 'Accidentes Tránsito'],
        data: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1], // Inverted rank
        colors: Array(10).fill(colors.secondary),
        kpiCause: 'Afecciones Pulmonares',
        kpiVolume: 10,
        kpiPrefix: 'Puntaje de Ranking: ',
        kpiRisk: 'Fuerte rezago estadístico por pandemia',
        isRank: true
    }
};

let dynamicChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    initBenchmarkChart();
    initDynamicChart();
    
    // Setup Tabs
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            tabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            
            const countryKey = e.target.getAttribute('data-country');
            updateDashboard(countryKey);
        });
    });

    // Initialize with Mexico
    updateDashboard('mexico');
});

function initBenchmarkChart() {
    const ctx = document.getElementById('benchmarkChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['México', 'EE. UU.', 'Venezuela', 'Perú'],
            datasets: [
                {
                    label: 'Cardiovasculares (Nivel 1-10)',
                    data: [10, 10, 10, 8],
                    backgroundColor: colors.primary,
                    borderRadius: 4
                },
                {
                    label: 'Cáncer / Tumores',
                    data: [8, 9, 9, 4],
                    backgroundColor: colors.secondary,
                    borderRadius: 4
                },
                {
                    label: 'Causas Externas (Violencia/Accidentes)',
                    data: [8, 8, 6, 1],
                    backgroundColor: colors.alert,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { usePointStyle: true } }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    max: 10
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function initDynamicChart() {
    const ctx = document.getElementById('dynamicChart').getContext('2d');
    dynamicChartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: [], datasets: [] },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 800,
                easing: 'easeOutQuart'
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const isRank = context.dataset.isRank;
                            if (isRank) return `Rango visual: Top ${11 - context.raw}`;
                            return context.raw.toLocaleString() + ' muertes';
                        }
                    }
                }
            },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { grid: { display: false } }
            }
        }
    });
}

function updateDashboard(countryKey) {
    const data = countryData[countryKey];
    
    // 1. Update Chart
    dynamicChartInstance.data = {
        labels: data.labels,
        datasets: [{
            data: data.data,
            backgroundColor: data.colors,
            borderRadius: 4,
            isRank: data.isRank || false
        }]
    };
    dynamicChartInstance.update();

    // 2. Update KPIs
    document.getElementById('kpi-main-cause').textContent = data.kpiCause;
    document.getElementById('kpi-risk').textContent = data.kpiRisk;
    
    // 3. Animate Counter
    animateValue('kpi-volume', 0, data.kpiVolume, 1000, data.kpiPrefix, data.isRank);
    
    // 4. Trigger fade animation
    const content = document.getElementById('dashboardContent');
    content.classList.remove('fade-in');
    void content.offsetWidth; // trigger reflow
    content.classList.add('fade-in');
}

function animateValue(id, start, end, duration, prefix, isRank) {
    const obj = document.getElementById(id);
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        // easeOut function
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(easeProgress * (end - start) + start);
        
        if (isRank && current === end) {
             obj.textContent = prefix + "Alto"; 
        } else {
             obj.textContent = prefix + current.toLocaleString();
        }
        
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}
