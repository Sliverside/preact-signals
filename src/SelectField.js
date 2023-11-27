import { BaseField } from "./BaseField";
import { createElement, removeDiacritics, extend } from "./helpers";
import { Observable, Computed } from "./Observable";
import { Floater } from "./Floater";

export function SelectField(container, config) {

    if (!(this instanceof SelectField)) {
        throw new Error("SelectField must be called using 'new' keyword")
    }

    if(!(container instanceof HTMLElement)) {
        throw new Error("container should be an HTMLElement")
    }

    this.defaultConfig = {
        searchable: false
    }

    this.config = undefined
    this.container = undefined
    this.baseField = undefined
    this.select = undefined
    this.options = undefined
    this.nativeOptions = undefined
    this.filtredOptionsIndexes = undefined
    this.filtredOptions = undefined
    this.isOpen = undefined
    this.navIndex = undefined
    this.isNavigating = undefined
    this.optionsElements = {}
    this.selectedDisplay = undefined
    this.dropdown = undefined
    this.optionsContainer = undefined
    this.typedTextTimoutId = undefined
    this.lastTypedText = ""
    this.searchInput = undefined

    this.init = function () {
        // Merge defaults with user set config
        this.config = extend(this.defaultConfig, config);
        this.container = container
        this.select = this.container.querySelector('select.field__input')

        if (!(this.select instanceof HTMLSelectElement)) {
            throw new Error("the container should contains a 'input.field__input' element with a type not equal to radio or checkbox")
        }

        if(this.container.dataset.searchable && (!config || typeof config.searchable === 'undefined')) {
            this.config.searchable = true
        }

        this.baseField = new BaseField(this.container)
        this.baseField.value.set([])
        this.isOpen = new Observable(false)
        this.navIndex = new Observable(0)
        this.isNavigating = new Observable(true)
        this.options = new Observable([])
        this.filtredOptionsIndexes = new Observable(null)
        this.filtredOptions = new Computed(() => {
            if(this.filtredOptionsIndexes.get() === null) return this.options.get()
            return this.filtredOptionsIndexes.get().map(id => this.options.get()[id])
        }, [this.filtredOptionsIndexes])

        const optionsIds = new Computed(() => this.options.get().map(option => option.id), [this.options])
        this.nativeOptions = {}

        this.selectedDisplay = createElement('div', {
            classList: ['field__selected'],
            children: [' ']
        })

        this.dropdown = createElement('div', {
            classList: ['field__dropdown']
        })

        this.optionsContainer = createElement('div', {
            classList: ['field__options', this.select.multiple ? 'multiple' : 'simple']
        })

        this.selectedDisplay.tabIndex = 0
        if(!this.config.searchable) this.optionsContainer.tabIndex = 0
        this.dropdownFloater = new Floater(this.container, this.dropdown)

        this.container.addEventListener('keydown', this.onKeydown)

        this.baseField.focusedElement.subscribe(focusedElement => {
            if(focusedElement === this.selectedDisplay) this.isOpen.set(false)
        })

        this.selectedDisplay.addEventListener('pointerdown', e => {
            if(e.target === this.selectedDisplay) {
                e.preventDefault()
                this.isOpen.set(!this.isOpen.get())
            }
        })

        const onOptionsContainerPointermove = () => { this.isNavigating.set(false) }

        onOptionsContainerPointermove()

        this.isNavigating.subscribe(value => {
            if (value) this.optionsContainer.addEventListener('pointermove', onOptionsContainerPointermove, { passive: true })
            else this.optionsContainer.removeEventListener('pointermove', onOptionsContainerPointermove)
            this.optionsContainer.classList.toggle('isNavigating', this.isNavigating.get())
            this.optionsContainer.classList.toggle('isNotNavigating', !this.isNavigating.get())
        })

        const tempOptions = []
        for (let i = 0; i < this.select.options.length; i++) {
            const nativeOption = this.select.options[i];
            const option = this.createOption({
                label: nativeOption.textContent,
                value: nativeOption.value
            })

            tempOptions.push(option)
            this.nativeOptions[option.id] = nativeOption
        }

        this.options.set(tempOptions)

        this.container.appendChild(this.selectedDisplay)
        this.dropdown.appendChild(this.optionsContainer)
        this.container.appendChild(this.dropdown)
        this.select.style.display = "none"
        this.select.tabIndex = -1

        this.baseField.isFocus.subscribe(() => {
            if(!this.baseField.isFocus.get()) this.isOpen.set(false)
        })

        this.isOpen.subscribe(() => {
            this.container.classList.toggle('isOpen', this.isOpen.get())
            this.dropdownFloater.isVisible.set(this.isOpen.get())
        if(this.isOpen.get()) {
            const focusTarget = this.config.searchable ? this.searchInput : this.optionsContainer
            focusTarget.focus()
        }
        })

        this.baseField.value.subscribe(() => {
            const displayValue = this.renderSelectedDisplay()
            this.selectedDisplay.innerHTML = displayValue === "" ? "&nbsp;" : displayValue
            this.selectedDisplay.title = displayValue

            if(this.baseField.value.get().length < 1) {
                this.select.selectedIndex = -1
            }
        })

        optionsIds.subscribe(() => {
            this.optionsContainer.textContent = ""
            for (let i = 0; i < optionsIds.get().length; i++) {
                const optionId = optionsIds.get()[i];
                const optionElement = this.createOptionElement(optionId)

                this.optionsContainer.appendChild(optionElement)
            }
        })

        if(this.config.searchable) this.initSearchable()
    }

    this.createOptionElement = function (optionId) {

        const option = this.options.get()[optionId]

        if (!option) return

        if (this.optionsElements[option.id]) return this.optionsElements[option.id]

        const optionElement = createElement('div', {
            classList: ['field__option'],
            children: [option.label],
        })

        const nativeOption = this.nativeOptions[optionId]

        this.baseField.value.subscribe(() => {
            const isSelected = this.baseField.value.get().includes(option.id)
            optionElement.classList.toggle('isSelected', isSelected)
            if(nativeOption) nativeOption.selected = isSelected
            if (isSelected && !this.select.multiple) this.scrolloptionElementIntoView(optionElement)
        })

        this.navIndex.subscribe(() => {
            const isActiveOption = this.select.multiple && option.id === this.navIndex.get()
            optionElement.classList.toggle('isActive', isActiveOption)

            if (isActiveOption && this.select.multiple) this.scrolloptionElementIntoView(optionElement)
        })

        this.filtredOptionsIndexes.subscribe(value => {
            const isFiltredOption = value === null || value.includes(option.id)
            optionElement.classList.toggle('hide', !isFiltredOption)
        })

        optionElement.addEventListener('click', e => {
            e.preventDefault()
            this.toggleOption(option.id)
            if (!this.select.multiple) this.selectedDisplay.focus()
        })

        return optionElement
    }

    this.createOption = function ({ label, value, id }) {
        if (!id && typeof id !== "number") id = this.uid.get()
        if (typeof id !== "number" && typeof id !== "string") throw new Error('id must be a string, a number or a "falsy" value')

        return { id, label, value }
    }

    this.onKeydown = e => {

        if (!this.isOpen.get() && [" ", "Enter", "ArrowDown", "ArrowUp"].includes(e.key)) {
            e.preventDefault()
            this.isOpen.set(true)
            return
        } else if (this.isOpen.get() && ["Escape"].includes(e.key)) {
            e.preventDefault()
            this.selectedDisplay.focus()
            return
        }

        if ([" ", "Enter"].includes(e.key)) {
            e.preventDefault()
            if(this.select.multiple) this.toggleOption(this.navIndex.get())
            else this.selectedDisplay.focus()
        } else if (["ArrowDown", "ArrowUp"].includes(e.key)) {
            e.preventDefault()
            this.isNavigating.set(true)

            let currentIndex = undefined
            let optionsLength = this.options.get().length

            currentIndex = this.baseField.value.get()[this.baseField.value.get().length - 1]

            if (this.select.multiple) currentIndex = this.navIndex.get()

            if(this.filtredOptionsIndexes.get() !== null) {
                currentIndex = this.filtredOptionsIndexes.get().indexOf(currentIndex)
                optionsLength = this.filtredOptionsIndexes.get().length
            }

            if (typeof currentIndex === "undefined") {
                currentIndex = 0
            } else {
                if (e.key === "ArrowUp") currentIndex--
                else if (e.key === "ArrowDown") currentIndex++
                if (currentIndex < 0) currentIndex = optionsLength - 1
                else if (currentIndex > optionsLength - 1) currentIndex = 0
            }

            let realIndex = this.filtredOptionsIndexes.get() === null
                ? currentIndex
                : this.filtredOptionsIndexes.get()[currentIndex]

            if (this.select.multiple) this.navIndex.set(realIndex)
            else this.selectOption(realIndex)
        } else if (e.key.length === 1) {
            // e.key.length === 1 : on verifie que le charactère est imprimable (ignore esc, tab, vermaj, maj, f1, f2...)

            if(this.searchInput && this.baseField.focusedElement.get() === this.searchInput) return

            if(this.select.multiple) this.isOpen.set(true)

            this.isNavigating.set(true)
            this.lastTypedText += e.key

            const findedOption = this.findFirstMatchingOption(this.lastTypedText)

            if (findedOption && typeof findedOption.id === "number") {
                if (this.select.multiple) this.navIndex.set(findedOption.id)
                else this.selectOption(findedOption.id)
            }

            if (this.typedTextTimoutId) {
                clearTimeout(this.typedTextTimoutId)
                this.typedTextTimoutId = undefined
            }

            this.typedTextTimoutId = setTimeout(() => {
                this.lastTypedText = ""
            }, 700);

        }
    }

    this.findMatchingOptions = function (query, options, first) {
        query = removeDiacritics(query.trim().toLowerCase())
        const finded = []
        for (let i = 0; i < options.length; i++) {
            const option = options[i];
            const valueToCompare = removeDiacritics(option.label.trim().substring(0, query.length).toLowerCase())
            if (valueToCompare === query) {
                const result = option
                if(first) return result
                finded.push(result)
            }
        }

        if(first) return null
        return finded
    }

    this.findFirstMatchingOption = function (query) {
        return this.findMatchingOptions(query, this.filtredOptions.get(), true)
    }

    this.filterOptions = function (query) {
        if(query.trim() === '') {
            this.filtredOptionsIndexes.set(null)
            return
        }
        const finded = this.findMatchingOptions(query, this.options.get())
        this.filtredOptionsIndexes.set(finded.map(option => option.id))
    }

    this.scrolloptionElementIntoView = function (optionElement) {

        const st = this.optionsContainer.scrollTop
        const top = optionElement.offsetTop
        const bottom = optionElement.offsetTop + optionElement.offsetHeight - this.optionsContainer.offsetHeight

        if(st <= top && st >= bottom) return

        this.optionsContainer.scrollTop = st > top ? top : bottom
    }

    this.toggleOption = function (id) {
        if (this.baseField.value.get().includes(id)) this.deselectOption(id)
        else this.selectOption(id)
    }

    this.selectOption = function (id) {
        if (this.baseField.value.get().includes(id)) return
        if (this.select.multiple) this.baseField.value.set([...this.baseField.value.get(), id])
        else this.baseField.value.set([id])
    }

    this.deselectOption = function (id) {
        if (!this.baseField.value.get().includes(id)) return
        this.baseField.value.set(this.baseField.value.get().filter((value) => value !== id))
    }

    this.renderSelectedDisplay = function () {
        if (!this.baseField.value.get().length === 0) return ""
        return this.baseField.value.get().reduce((acc, curr) => {
            const option = this.options.get()[curr]
            if (option) acc.push(option.label)
            return acc
        }, []).join(', ')
    }

    this.initSearchable = function() {
        this.searchInput = createElement('input', {
            classList: ['field__search'],
            properties: { type: 'search' }
        })
        this.dropdown.prepend(this.searchInput)

        this.optionsContainer.addEventListener('pointerdown', e => {
            e.preventDefault()
            e.stopPropagation()
        })

        const onInput = () => {
            this.filterOptions(this.searchInput.value)
        }

        this.searchInput.addEventListener('change', onInput)
        this.searchInput.addEventListener('input', onInput)
    }

    this.uid = (function () {
        let id = 0

        return {
            get: () => id++,
            reset: () => { id = 0 }
        }
    })();

    this.init()
    return this.baseField
}
