import { Computed, Observable, readonly } from "./Observable"
import { focusable } from "tabbable"

export function BaseField (container) {

    if(!(this instanceof BaseField)) {
        throw new Error("BaseField must be called using 'new' keyword")
    }

    if(!(container instanceof HTMLElement)) {
        throw new Error("container should be an HTMLElement")
    }

    this.container = undefined
    this.label = undefined
    this.value = undefined
    this.isFiled = undefined
    this.isFocus = undefined
    this.focusedElement = undefined
    this.focusableElements = undefined

    /**
     * @param {HTMLElement} container
     */
    this.init = function() {
        this.container = container
        this.label = container.querySelector('.field__label')
        this.value = new Observable(null)
        this.isFiled = new Computed(() => {
            return this.value.get() ? this.value.get().length > 0 : false
        }, [this.value])
        this.focusedElement = new Observable(null)
        this.isFocus = new Computed(() => {
            return !!this.focusedElement.get()
        }, [this.focusedElement])
        this.focusableElements = []

        this.isFiled.subscribe(() => this.container.classList.toggle('isFiled', this.isFiled.get()))
        this.isFocus.subscribe(() => this.container.classList.toggle('isFocus', this.isFocus.get()))

        new Promise(() => {
            setTimeout(() => {
                focusable(container, { displayCheck: 'none' })
                    .forEach(el => {
                        this.addFocusableElement(el)
                    })
            }, 10)
        })
    }

    this.addFocusableElement = function(element) {
        if(!(element instanceof HTMLElement)) throw new Error('element must be an instance of HTMLElement')
        if(this.focusableElements.indexOf(element) !== -1) return false
        this.focusableElements.push(element)
        if(element.tabIndex < 0) element.tabIndex = 0
        element.addEventListener('focus', () => this.focusElement(element), false)
        element.addEventListener('blur', () => this.blurElement(element), false)
    }

    this.focusElement = function(element) {
        if(this.focusableElements.indexOf(element) === -1) throw new Error('this element is not focusable, add it with addFocusableElement before focussing it')
        this.focusedElement.set(element)
        if(document.activeElement !== element) element.focus()
    }

    this.blurElement = function(element) {
        if(this.focusableElements.indexOf(element) === -1) throw new Error('this element is not focusable, add it with addFocusableElement before focussing it')
        if(this.focusedElement.get() === element) this.focusedElement.set(null)
    }

    this.init()

    return Object.defineProperties({}, {
        container: {
            get: () => this.container,
            set() { throw new Error("container is a readonly property") },
        },
        label: {
            get: () => this.label,
            set() { throw new Error("label is a readonly property") },
        },
        value: {
            get: () => this.value,
            set() { throw new Error("value is an Observable, use value.set method") },
        },
        isFiled: {
            get: () => this.isFiled,
            set() { throw new Error("isFiled is an Observable, use isFiled.set method") },
        },
        isFocus: {
            get: () => readonly(this.isFocus),
            set() { throw new Error("isFocus is an Observable, use isFocus.set method") },
        },
        addFocusableElement: {
            value: (element) => true,
            writable: false
        },
        focusedElement: {
            get: () => readonly(this.focusedElement),
            set() { throw new Error("focusedElement is a readonly property") },
        }
    })
}
