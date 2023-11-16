import { computed, signal, effect } from "@preact/signals-core"

export function BaseField (container) {
    this.container = undefined
    this.label = undefined
    this.value = undefined
    this.isFiled = undefined
    this.isFocus = undefined

    /**
     * @param {HTMLElement} container
     */
    this.init = function() {
        if(!(container instanceof HTMLElement)) {
            throw new Error("container should be an HTMLElement")
        }
        this.container = container
        this.label = container.querySelector('.field__label')
        this.value = signal(null)
        this.isFiled = computed(() => this.value.value ? this.value.value.length > 0 : false)
        this.isFocus = signal(false)

        effect(() => {
            this.container.classList.toggle('isFiled', this.isFiled.value)
        })
        effect(() => {
            this.container.classList.toggle('isFocus', this.isFocus.value)
        })
    }

    this.init()

    const that = this

    return {
        get container () {
            return that.container
        },
        set container (value) {
            throw new Error("container is a read only property")
        },
        get label () {
            return that.label
        },
        set label (value) {
            throw new Error("label is a read only property")
        },
        set value (value) {
            that.value.value = value
        },
        get value () {
            return that.value.value
        },
        get isFiled () {
            return that.isFiled.value
        },
        set isFiled (value) {
            throw new Error("isFiled is a read only property")
        },
        set isFocus (value) {
            that.isFocus.value = value
        },
        get isFocus () {
            return that.isFocus.value
        },
    }
}