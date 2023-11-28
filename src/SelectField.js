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
        filterable: false,
        searchable: false
    }

    this.config = undefined
    this.container = undefined
    this.baseField = undefined
    this.select = undefined
    this.options = undefined
    this.nativeOptionsElements = {}
    this.optionsElements = {}
    this.filterQuery = undefined
    this.isOpen = undefined
    this.navIndex = undefined
    this.isNavigating = undefined
    this.selectedDisplay = undefined
    this.dropdown = undefined
    this.optionsContainer = undefined
    this.typedTextTimoutId = undefined
    this.lastTypedText = ""
    this.queryInput = undefined

    this.init = function () {
        // Merge defaults with user set config
        this.config = extend(this.defaultConfig, config);
        this.container = container
        this.select = this.container.querySelector('select.field__input')

        if (!(this.select instanceof HTMLSelectElement)) {
            throw new Error("the container should contains a 'input.field__input' element with a type not equal to radio or checkbox")
        }

        if(this.config.searchable && typeof this.config.searchable !== 'function') {
            console.error('searchable configuration must be a function that accept a query and return options in the folowing format : {?id: string, value: string, ?label: string}')
            this.config.searchable = false
        }

        // cant be searchable and filterable at once
        if(!this.config.searchable && this.container.dataset.filterable && (!config || typeof config.filterable === 'undefined')) {
            this.config.filterable = true
        }

        this.baseField = new BaseField(this.container)
        this.baseField.value.set([])
        this.isOpen = new Observable(false)
        this.navIndex = new Observable(undefined)
        this.isNavigating = new Observable(true)
        this.options = new Observable([])
        this.filterQuery = new Observable("")
        this.filteredOptions = new Computed(() => this.options.get().filter(v => v.matchFilter.get()), [this.options, this.filterQuery])
        this.optionsIds = new Computed(() => this.options.get().map(option => option.id), [this.options])

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
        if(!this.queryInput) this.optionsContainer.tabIndex = 0
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

            tempOptions.push({
                label: nativeOption.textContent,
                value: nativeOption.value
            })
        }

        this.setOptions(tempOptions)

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
            const focusTarget = this.queryInput || this.optionsContainer
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

        this.optionsIds.subscribe((ids) => {
            this.optionsContainer.textContent = ""
            this.select.textContent = ""
            for (let i = 0; i < ids.length; i++) {
                const optionElement = this.createOptionElement(i)
                const nativeOptionElement = this.createNativeOptionElement(i)

                if(optionElement) this.optionsContainer.appendChild(optionElement)
                if(nativeOptionElement) this.select.appendChild(nativeOptionElement)
            }

            // cleanup

            for (const id in this.optionsElements) {
                if(ids.includes[id]) continue
                delete this.optionsElements[id]
            }

            for (const id in this.nativeOptionElement) {
                if(ids.includes[id]) continue
                delete this.nativeOptionElement[id]
            }
        })

        if(this.config.searchable) this.initSearchable()
        else if(this.config.filterable) this.initFilterable()
    }

    this.createOptionElement = function (optionId) {

        const option = this.options.get()[optionId]

        if (!option) return

        if (this.optionsElements[option.id]) return this.optionsElements[option.id]

        const optionElement = createElement('div', {
            classList: ['field__option'],
            children: [option.label],
        })

        option.selected.subscribe(() => {
            optionElement.classList.toggle('isSelected', option.selected.get())
            if (option.selected.get() && !this.select.multiple) this.scrolloptionElementIntoView(optionElement)
        })

        option.active.subscribe(() => {
            optionElement.classList.toggle('isActive', option.active.get())
            if (option.active.get() && this.select.multiple) this.scrolloptionElementIntoView(optionElement)
        })

        option.matchFilter.subscribe(() => {
            optionElement.classList.toggle('hide', !option.matchFilter.get())
        })

        optionElement.addEventListener('click', e => {
            e.preventDefault()
            this.toggleOption(option.id)
            if (!this.select.multiple) this.selectedDisplay.focus()
        })

        this.optionsElements[option.id] = optionElement
        return optionElement
    }

    this.createNativeOptionElement = function(optionIndex) {

        const option = this.options.get()[optionIndex]

        if (!option) return

        if (this.nativeOptionsElements[option.id]) return this.nativeOptionsElements[option.id]

        const nativeOptionElement = createElement('option', {
            properties: { value: option.value },
            children: [option.label],
        })

        option.selected.subscribe(() => {
            nativeOptionElement.selected = option.selected.get()
        })

        this.nativeOptionsElements[option.id] = nativeOptionElement
        return nativeOptionElement
    }

    this.createOption = function ({ label, value, id }) {
        if (!id && typeof id !== "number") id = this.uid.get()
        if (typeof id !== "number" && typeof id !== "string") throw new Error('id must be a string, a number or a "falsy" value')

        const normalizedLabel = this.normalizeString(label)
        const index = new Computed(() => this.optionsIds.get().indexOf(id), [this.optionsIds])

        const option = {
            id,
            index: index,
            label,
            value,
            selected: new Computed(() => this.baseField.value.get().includes(id), [this.baseField.value]),
            active: new Computed(() => {
                if(this.select.multiple && index.get() === this.navIndex.get()) {
                    console.log(index.get(), id, this.options.get())
                }
                return this.select.multiple && index.get() === this.navIndex.get()
            }, [this.navIndex]),
            matchFilter: new Computed(() => {
                return this.filterQuery.get() === "" || normalizedLabel.indexOf(this.filterQuery.get()) > -1
            }, [this.filterQuery]),
        }

        return option
    }

    this.setOptions = function (options) {
        const tempOptions = []
        for (let i = 0; i < options.length; i++) {
            tempOptions.push(this.createOption({...options[i], index: i}))
        }

        console.log(tempOptions);

        this.options.set(tempOptions)
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

            let currentIndex

            if (this.select.multiple) currentIndex = this.navIndex.get()

            if(typeof currentIndex === "undefined") {
                let lastOptionSelectedId = this.baseField.value.get()[this.baseField.value.get().length - 1]

                if(typeof lastOptionSelectedId !== 'undefined') {
                    let lastOptionSelected = this.filteredOptions.get().find(option => option.id === lastOptionSelectedId)
                    if(lastOptionSelected && typeof lastOptionSelected.index.get() === 'number') currentIndex = lastOptionSelected.index.get()
                }
            }

            if (typeof currentIndex === "undefined") {
                currentIndex = 0
            } else {
                const optionsLength = this.filteredOptions.get().length
                if (e.key === "ArrowUp") currentIndex--
                else if (e.key === "ArrowDown") currentIndex++
                if (currentIndex < 0) currentIndex = optionsLength - 1
                else if (currentIndex > optionsLength - 1) currentIndex = 0
            }

            const option = this.filteredOptions.get()[currentIndex]

            if(option) {
                if(this.select.multiple) {
                    if(typeof option.index.get() === 'number') this.navIndex.set(option.index.get())
                } else {
                    if(["string", "number"].includes(typeof option.id)) this.selectOption(option.id)
                }
            }

        } else if (e.key.length === 1) {
            // e.key.length === 1 : on verifie que le charactère est imprimable (ignore esc, tab, vermaj, maj, f1, f2...)

            if(this.queryInput && this.baseField.focusedElement.get() === this.queryInput) return

            if(this.select.multiple) this.isOpen.set(true)

            this.isNavigating.set(true)
            this.lastTypedText += e.key

            const findedOption = this.findFirstMatchingOption(this.lastTypedText)

            if (findedOption && ["string", "number"].includes(typeof findedOption.id)) {
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
        query = this.normalizeString(query)
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

    this.normalizeString = function (string) {
        return removeDiacritics(string.trim().toLowerCase().replace(/\s{2,}/, ' '))
    }

    this.findFirstMatchingOption = function (query) {
        return this.findMatchingOptions(query, this.filteredOptions.get(), true)
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

    this.setupQueryInput = function() {
        const mode = "dropdown"
        this.queryInput = createElement('input', {
            classList: ['field__search'],
            properties: { type: 'search' }
        })

        if(mode === "dropdown") {
            this.dropdown.prepend(this.queryInput)

            this.optionsContainer.addEventListener('pointerdown', e => {
                // permet d'evier que "queryInput" perdent le focus au clic
                // solution temporaire à changer au plus vite
                // il faut trouver une meilleure façon de gérer le focus
                e.preventDefault()
                e.stopPropagation()
            })
        }

        if(typeof this.queryInput === HTMLInputElement) {
            throw new Error("Internal Error : this.queryInput should be an HTMLInputElement , got '" + typeof this.queryInput + "'")
        }

        return this.queryInput
    }

    this.initFilterable = function() {
        const queryInput = this.setupQueryInput()
        const onInput = () => {
            this.filterQuery.set(this.normalizeString(queryInput.value))
        }

        queryInput.addEventListener('change', onInput)
        queryInput.addEventListener('input', onInput)
    }

    this.initSearchable = function() {
        const queryInput = this.setupQueryInput()
        const onInput = async () => {
            const results = await this.config.searchable(queryInput.value)
            this.setOptions(results)
        }

        queryInput.addEventListener('change', onInput)
        queryInput.addEventListener('input', onInput)
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
