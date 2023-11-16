import { BaseField } from "./BaseField";

export function TextField (container) {
    this.baseField = undefined
    this.input = undefined

    this.init = function() {
        this.input = container.querySelector('input.field__input, textarea.field__input')

        if(
            (!(this.input instanceof HTMLInputElement) || ['radio', 'checkbox'].includes(this.input.type))
            && !(this.input instanceof HTMLTextAreaElement)
        ) {
            throw new Error("the container should contains a 'input.field__input' element with a type not equal to radio or checkbox")
        }
        
        this.baseField = new BaseField(container)

        this.baseField.container.addEventListener('pointerdown', e => {
            e.stopPropagation()
            this.focus()
        })

        this.baseField.container.addEventListener('click', e => {
            e.stopPropagation()
        })

        const onInput = () => {
            this.baseField.value = this.input.value
        }

        onInput()
        this.input.addEventListener('input', onInput)
        this.input.addEventListener('change', onInput)

        this.input.addEventListener('focus', () => {
            this.baseField.isFocus = true
        }, false)
        this.input.addEventListener('blur', () => {
            this.baseField.isFocus = false
        }, false)

        if(this.baseField.label) {
            // prevent blur when holding label
            this.baseField.label.addEventListener('pointerdown', e => e.preventDefault())
        }
    }

    this.focus = function() {
        this.baseField.isFocus = true
        this.input.focus()
    }

    this.init()
    return this.baseField
}