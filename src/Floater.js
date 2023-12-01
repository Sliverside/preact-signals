import { Observable, readonly } from "./Observable"
import { computePosition, flip, size, autoUpdate } from "@floating-ui/dom"
import { extend } from "./helpers"

export function Floater(reference, floating, config) {
    if (!(this instanceof Floater)) {
        throw new Error("Floater must be called using 'new' keyword")
    }
    if (!(reference instanceof HTMLElement)) {
        throw new Error("reference should be an HTMLElement")
    }
    if (!(floating instanceof HTMLElement)) {
        throw new Error("floating should be an HTMLElement")
    }

    this.defaultConfig = {
        placement: 'bottom-start',
        middleware: {
            flip: true,
            size: true,
        }
    }

    this.config = undefined
    this.isOpen = undefined
    this.floating = undefined
    this.reference = undefined
    this.middleware = []

    this.init = function () {
        // Merge defaults with user set config
        this.config = extend(this.defaultConfig, config);
        this.isOpen = new Observable(false)
        this.reference = reference
        this.floating = floating

        let autoUpdateCleanup


        this.floating.classList.add('floater')

        if (this.config.middleware.flip) {
            this.middleware.push(flip({
                padding: 10,
                crossAxis: false
            }))
        }

        if (this.config.middleware.size) {
            this.middleware.push(size({
                padding: 10,
                apply({ availableWidth, availableHeight, elements }) {
                    Object.assign(elements.floating.style, {
                        maxWidth: `${availableWidth}px`,
                        maxHeight: `${availableHeight}px`
                    });
                }
            }))
        }


        this.isOpen.subscribe(() => {
            this.reference.classList.toggle('isFloaterOpen', this.isOpen.get())
            this.floating.classList.toggle('isOpen', this.isOpen.get())

            if (typeof autoUpdateCleanup === "function") {
                autoUpdateCleanup()
                autoUpdateCleanup = undefined
            }

            if (this.isOpen.get()) {
                autoUpdateCleanup = autoUpdate(
                    this.reference,
                    this.floating,
                    this.computePosition
                )
            }
        })

    }

    this.computePosition = () => {
        computePosition(this.reference, this.floating, {
            placement: this.config.placement,
            middleware: this.middleware
        }).then(({ x, y }) => {
            Object.assign(this.floating.style, {
                left: `${x}px`,
                top: `${y}px`,
            });
        })
    }

    this.init()

    return Object.defineProperties({}, {
        reference: {
            get: () => this.reference,
            set() { throw new Error("reference is a read only property") },
        },
        floating: {
            get: () => this.floating,
            set() { throw new Error("floating is a read only property") },
        },
        isOpen: {
            get: () => readonly(this.isOpen),
            set() { throw new Error("isOpen is an Observable, use isOpen.set method") },
        },
        open: {
            value: () => {
                return this.isOpen.set(true)
            },
            readonly: true
        },
        close: {
            value: () => {
                return this.isOpen.set(false)
            },
            readonly: true
        },
        toggleOpen: {
            value: (force) => {
                return this.isOpen.set(typeof force === 'undefined' ? !this.isOpen.get() : force)
            },
            readonly: true
        }
    })
}