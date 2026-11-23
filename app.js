/**
 * Magic Fold 3D - Application Logic
 * Audio FX, UI Handlers, Curriculum Quizzes, Video Sync, Gallery Modal
 */

// --- 1. Sound Synthesizer (Web Audio API) ---
class SoundManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.lastSoundTime = 0;
  }

  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
  }

  playTensionPull(progress) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = Date.now();
    if (now - this.lastSoundTime < 80) return; // Throttle sound
    this.lastSoundTime = now;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // Pitch rises as string is pulled tighter (300Hz ~ 800Hz)
      const freq = 260 + progress * 500;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  playSnapComplete() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      // Pleasant chime chord for 3D solid completion
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C Major Chord
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.04);

        gain.gain.setValueAtTime(0.08, this.ctx.currentTime + idx * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.04 + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(this.ctx.currentTime + idx * 0.04);
        osc.stop(this.ctx.currentTime + idx * 0.04 + 0.35);
      });
    } catch (e) {
      console.warn('Audio snap error:', e);
    }
  }

  playClick() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch (e) {}
  }
}

const sounds = new SoundManager();

// --- 2. Main App Controller ---
document.addEventListener('DOMContentLoaded', () => {
  // Initialize 3D Simulator
  const sim = new MagicFoldSimulator('canvas-container');

  // --- Sound Toggle Button ---
  const soundBtn = document.getElementById('sound-toggle-btn');
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      sounds.enabled = !sounds.enabled;
      soundBtn.innerHTML = sounds.enabled
        ? '<i data-lucide="volume-2" class="w-5 h-5"></i><span class="text-xs">효과음 ON</span>'
        : '<i data-lucide="volume-x" class="w-5 h-5 text-gray-400"></i><span class="text-xs text-gray-400">효과음 OFF</span>';
      if (window.lucide) lucide.createIcons();
    });
  }

  // --- Pull String Slider Handlers ---
  const pullSlider = document.getElementById('pull-slider');
  const pullPercentageText = document.getElementById('pull-percentage');
  const tensionBar = document.getElementById('tension-bar');
  const foldStatusBadge = document.getElementById('fold-status-badge');

  if (pullSlider) {
    pullSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value) / 100;
      sim.setProgress(val);
      sounds.playTensionPull(val);
    });
  }

  sim.onProgressChange = (progress) => {
    const pct = Math.round(progress * 100);
    if (pullSlider && Math.abs(parseFloat(pullSlider.value) - pct) > 1) {
      pullSlider.value = pct;
    }
    if (pullPercentageText) pullPercentageText.textContent = pct + '%';
    if (tensionBar) {
      tensionBar.style.width = pct + '%';
      if (pct > 80) tensionBar.style.backgroundColor = '#10b981'; // Green
      else if (pct > 40) tensionBar.style.backgroundColor = '#f59e0b'; // Amber
      else tensionBar.style.backgroundColor = '#3b82f6'; // Blue
    }
    if (foldStatusBadge) {
      if (pct === 0) {
        foldStatusBadge.textContent = '평면 전개도 (2D Flat)';
        foldStatusBadge.className = 'px-3 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-700';
      } else if (pct === 100) {
        foldStatusBadge.textContent = '입체 완성 (3D Solid)';
        foldStatusBadge.className = 'px-3 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-700 animate-pulse';
      } else {
        foldStatusBadge.textContent = `실 당기는 중 (${pct}%)`;
        foldStatusBadge.className = 'px-3 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800';
      }
    }
  };

  sim.onCompleteFold = () => {
    sounds.playSnapComplete();
  };

  // Quick Action Buttons
  const btnFlat = document.getElementById('btn-flat-0');
  const btnSolid = document.getElementById('btn-solid-100');
  const btnAutoFold = document.getElementById('btn-auto-fold');

  if (btnFlat) {
    btnFlat.addEventListener('click', () => {
      sounds.playClick();
      sim.setProgress(0);
    });
  }

  if (btnSolid) {
    btnSolid.addEventListener('click', () => {
      sim.setProgress(1);
    });
  }

  if (btnAutoFold) {
    btnAutoFold.addEventListener('click', () => {
      sounds.playClick();
      const isAuto = sim.toggleAutoFold();
      btnAutoFold.innerHTML = isAuto
        ? '<i data-lucide="pause" class="w-4 h-4"></i> 정지'
        : '<i data-lucide="play" class="w-4 h-4"></i> 1초 자동 변신';
      if (window.lucide) lucide.createIcons();
    });
  }

  // Camera Presets
  document.querySelectorAll('[data-camera-preset]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      sounds.playClick();
      const preset = e.currentTarget.getAttribute('data-camera-preset');
      sim.setCameraPreset(preset);
    });
  });

  // Wireframe Toggle
  const btnWireframe = document.getElementById('btn-toggle-wireframe');
  if (btnWireframe) {
    btnWireframe.addEventListener('click', () => {
      sounds.playClick();
      const isWire = sim.toggleWireframe();
      btnWireframe.classList.toggle('bg-blue-100', isWire);
      btnWireframe.classList.toggle('text-blue-700', isWire);
    });
  }

  // Shape Selector Tabs
  const shapeInfoDesc = document.getElementById('shape-info-desc');
  const shapeInfoCurriculum = document.getElementById('shape-info-curriculum');
  const shapeInfoTitle = document.getElementById('shape-info-title');

  const shapeDetails = {
    cube: {
      title: '정육면체 (Cube)',
      desc: '십자형 전개도에서 6개의 합동인 정사각형 면이 실의 장력으로 동시에 90도 기립하여 완벽한 상자로 닫힙니다.',
      curriculum: '초등 5학년 2학기 [직육면체] - 마주 보는 면의 평행과 수직 관계 직관 체득'
    },
    prism: {
      title: '삼각기둥 (Triangular Prism)',
      desc: '2개의 합동인 삼각형 밑면과 3개의 직사각형 옆면이 결합되어 기둥을 이룹니다. 손잡이를 당기면 텐션이 전달됩니다.',
      curriculum: '초등 6학년 1학기 [각기둥과 각뿔] - 밑면 2개는 합동, 옆면은 직사각형 성질 증명'
    },
    cylinder: {
      title: '원기둥 (Cylinder)',
      desc: '평면 직사각형 옆면이 둥글게 곡면으로 롤링되며 상·하 원형 뚜껑이 착 결속됩니다. (가로 18cm = 원둘레 2πr 증명)',
      curriculum: '초등 6학년 2학기 [원기둥, 원뿔, 구] - 직사각형 가로 = 밑면 원둘레 공식 유도'
    },
    pyramid: {
      title: '별모양 각뿔 (Star Pyramid)',
      desc: '방사형으로 펼쳐진 삼각형 날개들이 단 한 가닥의 실을 조이는 순간, 단 하나의 꼭짓점으로 일제히 수렴합니다.',
      curriculum: '초등 6학년 1학기 [각기둥과 각뿔] - 모든 옆면이 삼각형이며 한 꼭짓점으로 모이는 원리'
    }
  };

  document.querySelectorAll('.shape-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      sounds.playClick();
      document.querySelectorAll('.shape-tab-btn').forEach(b => {
        b.classList.remove('active', 'border-blue-600', 'bg-blue-50', 'text-blue-700');
        b.classList.add('border-transparent', 'text-gray-600');
      });
      btn.classList.add('active', 'border-blue-600', 'bg-blue-50', 'text-blue-700');
      btn.classList.remove('border-transparent', 'text-gray-600');

      const shape = btn.getAttribute('data-shape');
      sim.setShape(shape);

      if (shapeDetails[shape]) {
        if (shapeInfoTitle) shapeInfoTitle.textContent = shapeDetails[shape].title;
        if (shapeInfoDesc) shapeInfoDesc.textContent = shapeDetails[shape].desc;
        if (shapeInfoCurriculum) shapeInfoCurriculum.textContent = shapeDetails[shape].curriculum;
      }
    });
  });

  // --- 3. Interactive Curriculum Labs ---
  // Lab 1: Face Count Invariance ("면의 개수 불변성 탐구")
  const btnCountFaces = document.getElementById('btn-count-faces');
  const countDisplay = document.getElementById('count-display');
  const countFeedback = document.getElementById('count-feedback');

  if (btnCountFaces) {
    let countingInterval = null;
    btnCountFaces.addEventListener('click', () => {
      sounds.playClick();
      if (countingInterval) clearInterval(countingInterval);

      let currentFace = 1;
      btnCountFaces.disabled = true;
      countFeedback.textContent = '1번 면부터 6번 면까지 확인하는 중...';

      countingInterval = setInterval(() => {
        countDisplay.textContent = `${currentFace} / 6`;
        sounds.playClick();

        if (currentFace === 6) {
          clearInterval(countingInterval);
          btnCountFaces.disabled = false;
          countFeedback.innerHTML = '<span class="text-emerald-600 font-bold">✨ 발견!</span> 평면 전개도일 때도 6개, 실을 당겨 입체가 되어도 <strong>면의 개수는 6개로 절대 변하지 않습니다</strong> (도형 형태 불변성의 원리).';
          sounds.playSnapComplete();
        } else {
          currentFace++;
        }
      }, 500);
    });
  }

  // Lab 2: Cylinder Circumference Formula ($2\pi r = 가로$)
  const radiusSlider = document.getElementById('radius-slider');
  const radiusVal = document.getElementById('radius-val');
  const calcResult = document.getElementById('calc-result');
  const formulaMath = document.getElementById('formula-math');

  if (radiusSlider) {
    radiusSlider.addEventListener('input', (e) => {
      const r = parseFloat(e.target.value);
      if (radiusVal) radiusVal.textContent = r.toFixed(1) + 'cm';
      const circumference = (2 * 3.14159 * r).toFixed(1);
      if (calcResult) calcResult.textContent = circumference + 'cm';
      if (formulaMath) {
        formulaMath.textContent = `2 × 3.14 × ${r.toFixed(1)}cm = 약 ${circumference}cm`;
      }
      sounds.playClick();
    });
  }

  // --- 4. Video & Timeline Sync ---
  const video = document.getElementById('shorts-video');
  const timelineItems = document.querySelectorAll('.timeline-item');

  timelineItems.forEach(item => {
    item.addEventListener('click', () => {
      sounds.playClick();
      const targetTime = parseFloat(item.getAttribute('data-time'));
      if (video) {
        video.currentTime = targetTime;
        video.play();
      }
      setActiveTimelineItem(item);
    });
  });

  function setActiveTimelineItem(activeEl) {
    timelineItems.forEach(el => el.classList.remove('active', 'border-blue-500', 'bg-blue-50'));
    activeEl.classList.add('active', 'border-blue-500', 'bg-blue-50');
  }

  if (video) {
    video.addEventListener('timeupdate', () => {
      const cur = video.currentTime;
      timelineItems.forEach(item => {
        const tStart = parseFloat(item.getAttribute('data-time'));
        const tEnd = parseFloat(item.getAttribute('data-time-end') || tStart + 3);
        if (cur >= tStart && cur < tEnd) {
          setActiveTimelineItem(item);
        }
      });
    });
  }

  // --- 5. Gallery Modal ---
  const modal = document.getElementById('gallery-modal');
  const modalImg = document.getElementById('modal-img');
  const modalCaption = document.getElementById('modal-caption');
  const modalClose = document.getElementById('modal-close');

  document.querySelectorAll('.gallery-thumb').forEach(thumb => {
    thumb.addEventListener('click', (e) => {
      sounds.playClick();
      const src = e.currentTarget.getAttribute('data-src');
      const caption = e.currentTarget.getAttribute('data-caption') || '';
      if (modal && modalImg) {
        modalImg.src = src;
        if (modalCaption) modalCaption.textContent = caption;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
      }
    });
  });

  if (modalClose && modal) {
    modalClose.addEventListener('click', () => {
      sounds.playClick();
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
      }
    });
  }

  // --- 6. DIY Checklist & FAQ Accordion ---
  const checkboxes = document.querySelectorAll('.diy-checkbox');
  const progressText = document.getElementById('diy-checklist-progress');

  function updateChecklistProgress() {
    let checkedCount = 0;
    checkboxes.forEach(cb => {
      if (cb.checked) checkedCount++;
    });
    if (progressText) {
      progressText.textContent = `${checkedCount} / ${checkboxes.length} 준비 완료`;
    }
  }

  checkboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      sounds.playClick();
      updateChecklistProgress();
    });
  });

  document.querySelectorAll('.accordion-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      sounds.playClick();
      const content = btn.nextElementSibling;
      const icon = btn.querySelector('.accordion-icon');
      if (content) {
        content.classList.toggle('hidden');
        if (icon) {
          icon.classList.toggle('rotate-180');
        }
      }
    });
  });

  // Render icons with Lucide
  if (window.lucide) {
    lucide.createIcons();
  }
});
