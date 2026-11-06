import { pseudoConsole } from './pseudo-console.js';
import { particlePopper } from './particle-pop.js';
import { skinTricks } from './skin-tricks.js';
import { initBlazeRave, triggerBlazeRave, isBlazeRaveActive } from './blaze-rave.js';
import { triggerMemeWebcam, tryTriggerSettingsEasterEgg, isMemeWebcamActive } from './meme-webcam.js';
import { audioSynth } from './audio-synth.js';

export { pseudoConsole } from './pseudo-console.js';
export { particlePopper } from './particle-pop.js';
export { skinTricks } from './skin-tricks.js';
export { triggerBlazeRave, isBlazeRaveActive } from './blaze-rave.js';
export { triggerMemeWebcam, tryTriggerSettingsEasterEgg, isMemeWebcamActive } from './meme-webcam.js';
export { audioSynth } from './audio-synth.js';

let secretKeyword = '';
let secretKeyTimeout = null;

/**
 * Инициализация всех систем пасхалок
 */
export function initAllEasterEggs() {
    // 1. Интерактивное лопание падающих частиц и комбо по листку
    particlePopper.init();

    // 2. Акробатика 3D скина при двойном клике
    skinTricks.init();

    // 3. 420 Rave Mode
    initBlazeRave();

    // 4. Горячая клавиша открытия псевдо-консоли (~ / ё / F12 / ввод "admin"/"op"/"hack")
    document.addEventListener('keydown', (e) => {
        // Открытие по Тильде (~) или Ё в любом регистре
        if (e.code === 'Backquote' || e.key === '`' || e.key === '~' || e.key === 'ё' || e.key === 'Ё') {
            // Если не печатаем в инпуте настроек/авторизации (кроме самой псевдо-консоли)
            const tag = e.target.tagName;
            if (e.target.id === 'pseudo-console-input') {
                e.preventDefault();
                pseudoConsole.toggle(false);
                return;
            }
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;

            e.preventDefault();
            pseudoConsole.toggle();
            return;
        }

        // Закрытие по Escape
        if (e.key === 'Escape' && pseudoConsole.isOpen) {
            pseudoConsole.toggle(false);
        }
    });

    // 5. Ввод ключевых слов ("admin", "op", "hack", "craft") на клавиатуре
    document.addEventListener('keypress', (e) => {
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;

        if (secretKeyTimeout) clearTimeout(secretKeyTimeout);
        secretKeyword += e.key.toLowerCase();

        if (secretKeyword.endsWith('admin') || secretKeyword.endsWith('rcon') || secretKeyword.endsWith('hack') || secretKeyword.endsWith('root')) {
            secretKeyword = '';
            pseudoConsole.toggle(true);
            return;
        }

        if (secretKeyword.endsWith('craft') || secretKeyword.endsWith('meme')) {
            secretKeyword = '';
            triggerMemeWebcam();
            return;
        }

        if (secretKeyword.length > 10) {
            secretKeyword = secretKeyword.slice(-10);
        }

        secretKeyTimeout = setTimeout(() => {
            secretKeyword = '';
        }, 2000);
    });

    console.log('🎮 Ganj4Craft Easter Eggs & Cheat Console ready! (Press ~ or type "admin")');
}
