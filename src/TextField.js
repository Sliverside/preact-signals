import { BaseField } from "./BaseField";
import { Observable } from "./Observable";
import { formatNumber } from "./helpers";

export function TextField(container) {

    if (!(this instanceof TextField)) {
        throw new Error("TextField must be called using 'new' keyword")
    }

    if (!(container instanceof HTMLElement)) {
        throw new Error("container should be an HTMLElement")
    }

    if (!(this instanceof TextField)) throw new Error("TextField must be called using 'new' keyword")
    
    this.eventTypes = [
        'change',
    ]

    this.baseField = undefined
    this.container = undefined
    this.input = undefined

    this.init = function () {
        this.input = container.querySelector('input.field__input, textarea.field__input')

        if (
            (!(this.input instanceof HTMLInputElement) || ['radio', 'checkbox'].includes(this.input.type))
            && !(this.input instanceof HTMLTextAreaElement)
        ) {
            throw new Error("the container should contains a 'input.field__input' element with a type not equal to radio or checkbox")
        }

        this.baseField = new BaseField(container)
        this.container = container

        if (this.input.type === 'number') {
            this.initNumberInput()
        } else {
            const onInput = () => this.baseField.value.set(this.input.value)
            onInput()
            this.input.addEventListener('input', onInput)
            this.input.addEventListener('change', onInput)
        }
    }

    this.initNumberInput = () => {
        const userInputValue = new Observable('')
        const userInput = this.input.cloneNode()

        userInput.removeAttribute('id')
        userInput.type = "text"
        userInput.removeAttribute('name')

        this.input.classList.add('field__input--hidden')
        this.input.tabIndex = -1
        this.container.appendChild(userInput)

        const tidyNumber = value => value.replaceAll(/\D+/g, '')

        const onInput = () => {
            const formated = formatNumber(tidyNumber(userInput.value))
            userInput.value = formated || ''
            userInputValue.set(userInput.value)
        }
        onInput()

        userInput.addEventListener('input', onInput)
        userInput.addEventListener('change', onInput)

        userInput.addEventListener('keypress', function (e) {
            // allow only numbers
            if (e.which < 48 || e.which > 57) e.preventDefault();
            
        })

        userInputValue.subscribe(value => {
            const _value = tidyNumber(value)
            this.input.value = _value
            this.baseField.value.set(_value)
        })

    }

    this.init()
    return Object.defineProperties({}, {
        on: {
            value: (eventType, listener) => {
                if (!this.eventTypes.includes(eventType)) {
                    throw new Error("eventType must be one of this values : " + this.eventTypes.join(', ') + " | given value : " + eventType)
                }

                if (typeof listener !== 'function') throw new Error('listener must be a function')

                if (eventType === 'change') {
                    return this.baseField.value.subscribe(() => {
                        listener(this.baseField.value.get())
                    }, { autoRun: false })
                }
            },
            writable: false
        },
        getValue: {
            value: () => this.baseField.value.get(),
            writable: false
        },
    })
}
