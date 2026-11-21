// Every GSAP animation lives here with the DESIGN.md motion tokens. Each one is feedback or a state change.
const gsap = window.gsap;
let reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (gsap) {
    gsap.matchMedia().add('(prefers-reduced-motion: reduce)', () => {
        reduced = true;
        return () => {
            reduced = false;
        };
    });
}

const animated = () => Boolean(gsap) && !reduced;

const CASCADE_STAGGER = 0.04;

/**
 * Checking: the box settles from 0.9 and the check pops in with a small overshoot.
 * Unchecking: the check shrinks back out. The fill itself is a CSS transition in app.css.
 * Boxes come in cascade order, so they follow each other. A second click mid-way retargets from where the check is.
 */
export function animateCheck(boxes, checked) {
    if (!animated()) return;
    boxes.forEach((box, position) => {
        const delay = position * CASCADE_STAGGER;
        const check = box.querySelector('i');
        const moving = gsap.isTweening(check);
        box.style.setProperty('--ui-check-delay', `${delay * 1000}ms`);
        gsap.killTweensOf(check);

        if (checked) {
            gsap.fromTo(box, { scale: 0.9 }, { scale: 1, delay, duration: 0.2, ease: 'power2.out', overwrite: true, clearProps: 'transform' });
            if (!moving) gsap.set(check, { opacity: 0, scale: 0.5 });
            gsap.to(check, { opacity: 1, scale: 1, delay, duration: 0.2, ease: 'back.out(2)', clearProps: 'opacity,transform' });
        } else {
            if (!moving) gsap.set(check, { opacity: 1, scale: 1 });
            gsap.to(check, { opacity: 0, scale: 0.5, delay, duration: 0.15, ease: 'power2.out', clearProps: 'opacity,transform' });
        }
    });
}

/** Rollback: drop any running check animation, so the boxes show their restored state. */
export function settleCheck(boxes) {
    if (!gsap) return;
    boxes.forEach((box) => {
        const check = box.querySelector('i');
        gsap.killTweensOf([box, check]);
        gsap.set([box, check], { clearProps: 'opacity,transform' });
        box.style.removeProperty('--ui-check-delay');
    });
}

/** Rollback: 4 px horizontal nudge, twice, 160 ms in total. */
export function nudge(row) {
    if (!animated()) return;
    gsap.to(row, { keyframes: { x: [0, -4, 4, -4, 4, 0] }, duration: 0.16, clearProps: 'transform' });
}

const counters = new WeakMap();

/** Numbers count to the new value. The first call sets the value without counting. */
export function countTo(node, value, format) {
    const previous = counters.get(node);
    previous?.tween?.kill();
    if (!animated() || !previous || previous.state.value === value) {
        node.textContent = format(value);
        counters.set(node, { state: { value } });
        return;
    }
    const { state } = previous;
    const tween = gsap.to(state, {
        value,
        duration: 0.6,
        ease: 'power1.out',
        onUpdate: () => {
            node.textContent = format(Math.round(state.value));
        },
    });
    counters.set(node, { state, tween });
}

export function scaleBar(node, ratio) {
    if (!animated()) {
        node.style.transform = `scaleX(${ratio})`;
        return;
    }
    gsap.to(node, { scaleX: ratio, duration: 0.6, ease: 'power1.out', overwrite: true });
}

/** New rows fade in, 20 ms stagger, at most 12 rows per batch. */
export function rowsIn(rows) {
    if (!animated() || rows.length === 0) return;
    gsap.from(rows.slice(0, 12), { opacity: 0, duration: 0.2, stagger: 0.02, clearProps: 'opacity' });
}

/** axis: 'y' for a modal or sheet coming from below, 'x' for a drawer coming from the right. */
export function dialogIn(backdrop, panel, axis) {
    if (!animated()) return;
    gsap.set(backdrop, { opacity: 0 });
    gsap.set(panel, { opacity: 0, [axis]: 12 });
    // Start after the browser has painted the new overlay. Otherwise that first heavy frame eats most of the 260 ms.
    requestAnimationFrame(() => requestAnimationFrame(() => {
        if (panel.dataset.closing) return;
        gsap.to(backdrop, { opacity: 1, duration: 0.26, ease: 'power3.out', clearProps: 'opacity' });
        gsap.to(panel, { opacity: 1, [axis]: 0, duration: 0.26, ease: 'power3.out', clearProps: 'opacity,transform' });
    }));
}

export function dialogOut(backdrop, panel, axis, done) {
    if (!animated()) {
        done();
        return;
    }
    panel.dataset.closing = 'true';
    gsap.killTweensOf([backdrop, panel]);
    gsap.to(backdrop, { opacity: 0, duration: 0.18, ease: 'power2.in' });
    gsap.to(panel, { opacity: 0, [axis]: 12, duration: 0.18, ease: 'power2.in', onComplete: done });
}
