/**
 * Ganj4Craft Launcher - 3D Skin Tricks & Acrobatics
 * Акробатические трюки (сальто, вращение на 360°), левитация в креативе и эффекты
 */

import { getSkinViewer3d, getSkinViewerMode } from '../skin-viewer/skin-viewer.js';
import { audioSynth } from './audio-synth.js';
import { dom } from '../../utils/dom.js';

class SkinTricksEngine {
    constructor() {
        this.isSpinning = false;
        this.isContinuousSpinning = false;
        this.isCreativeFloating = false;
        this.floatAnimId = null;
        this.continuousAnimId = null;
    }

    /**
     * Инициализация обработчиков клика по скину
     */
    init() {
        const container = dom.get('skin-viewer-container');
        if (!container) return;

        container.style.cursor = 'pointer';
        container.setAttribute('title', 'Двойной клик — акробатический трюк');

        // Двойной клик по персонажу
        container.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.doAcrobaticSpin();
        });
    }

    /**
     * Выполнить эффектный трюк (прыжок с переворотом на 360°)
     */
    doAcrobaticSpin() {
        if (this.isSpinning) return;
        const viewer = getSkinViewer3d();
        const mode = getSkinViewerMode();
        const container = dom.get('skin-viewer-container');

        audioSynth.playJump();

        if (mode !== '3d' || !viewer || !viewer.playerObject) {
            // Если включен 2D режим — анимируем CSS вращение
            if (container) {
                container.classList.add('skin-2d-flip');
                setTimeout(() => container.classList.remove('skin-2d-flip'), 600);
            }
            return;
        }

        this.isSpinning = true;
        const player = viewer.playerObject;
        const startRotY = player.rotation.y;
        const targetRotY = startRotY + Math.PI * 2;
        const jumpHeightPx = 24; // Прыжок в DOM-пространстве (без обрезки WebGL)

        const startTime = performance.now();
        const duration = 600; // ms

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(1, elapsed / duration);

            // Ease-out cubic
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            player.rotation.y = startRotY + (targetRotY - startRotY) * easeProgress;

            // Parabolic jump up and down in DOM space
            const jumpProgress = Math.sin(progress * Math.PI);
            if (container) {
                container.style.transform = `translate3d(0, -${jumpProgress * jumpHeightPx}px, 0)`;
            }

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                player.rotation.y = startRotY;
                if (container && !this.isCreativeFloating) {
                    container.style.transform = '';
                }
                this.isSpinning = false;
            }
        };

        requestAnimationFrame(animate);
    }

    /**
     * Включить / выключить левитацию в креативе
     */
    setCreativeMode(enabled) {
        this.isCreativeFloating = enabled;
        const container = dom.get('skin-viewer-container');

        if (enabled) {
            if (container) container.classList.add('creative-levitation');
            this.startFloatingLoop();
        } else {
            if (container) container.classList.remove('creative-levitation');
            this.stopFloatingLoop();
        }
    }

    startFloatingLoop() {
        if (this.floatAnimId) return;

        const startTime = performance.now();
        const container = dom.get('skin-viewer-container');

        const loop = (currentTime) => {
            if (!this.isCreativeFloating) return;

            const viewer = getSkinViewer3d();
            if (viewer && viewer.playerObject && !this.isSpinning) {
                const elapsed = (currentTime - startTime) / 1000;
                // Плавное парение вверх-вниз в DOM пространстве
                const floatOffset = Math.sin(elapsed * 2.5) * 6 + 10;
                if (container) {
                    container.style.transform = `translate3d(0, -${floatOffset}px, 0)`;
                }
                // Легкое покачивание плеч в 3D
                viewer.playerObject.rotation.z = Math.sin(elapsed * 1.5) * 0.04;
            }

            this.floatAnimId = requestAnimationFrame(loop);
        };

        this.floatAnimId = requestAnimationFrame(loop);
    }

    stopFloatingLoop() {
        if (this.floatAnimId) {
            cancelAnimationFrame(this.floatAnimId);
            this.floatAnimId = null;
        }

        const container = dom.get('skin-viewer-container');
        if (container) {
            container.style.transform = '';
        }

        const viewer = getSkinViewer3d();
        if (viewer && viewer.playerObject) {
            viewer.playerObject.position.y = 0;
            viewer.playerObject.rotation.z = 0;
        }
    }

    /**
     * Непрерывное рейв-вращение (для режима хаоса)
     */
    spinContinuous(enabled) {
        this.isContinuousSpinning = enabled;

        if (enabled) {
            if (this.continuousAnimId) return;
            const loop = () => {
                if (!this.isContinuousSpinning) return;
                const viewer = getSkinViewer3d();
                if (viewer && viewer.playerObject) {
                    viewer.playerObject.rotation.y += 0.15;
                }
                this.continuousAnimId = requestAnimationFrame(loop);
            };
            this.continuousAnimId = requestAnimationFrame(loop);
        } else {
            if (this.continuousAnimId) {
                cancelAnimationFrame(this.continuousAnimId);
                this.continuousAnimId = null;
            }
            const viewer = getSkinViewer3d();
            if (viewer && viewer.playerObject) {
                viewer.playerObject.rotation.y = -0.45; // default angle
            }
        }
    }
}

export const skinTricks = new SkinTricksEngine();
