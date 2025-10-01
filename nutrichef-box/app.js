const fs = require('fs');
const path = require('path');

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements --- //
    const recipesTab = document.getElementById('recipes-tab');
    const inventoryTab = document.getElementById('inventory-tab');
    const shoppingListTab = document.getElementById('shopping-list-tab');
    const nutritionGraphTab = document.getElementById('nutrition-graph-tab');

    const recipesSection = document.getElementById('recipes-section');
    const inventorySection = document.getElementById('inventory-section');
    const shoppingListSection = document.getElementById('shopping-list-section');
    const nutritionGraphSection = document.getElementById('nutrition-graph-section');

    const addRecipeBtn = document.getElementById('add-recipe-btn');
    const addInventoryBtn = document.getElementById('add-inventory-btn');
    const recipeList = document.getElementById('recipe-list');
    const inventoryList = document.getElementById('inventory-list');
    const shoppingListContent = document.getElementById('shopping-list-content');
    const nutritionChartCanvas = document.getElementById('nutrition-chart');
    const languageSwitcher = document.getElementById('language-switcher');
    const modalOverlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalForm = document.getElementById('modal-form');
    const toastElement = document.getElementById('toast');

    let db;
    let currentLanguage = 'ja';
    let translations = {};
    let nutritionChart; // Chart.js instance

    // --- Utility Functions --- //

    /**
     * Displays a toast notification with a given message.
     * @param {string} message - The message to display.
     */
    function showToast(message) {
        toastElement.textContent = message;
        toastElement.classList.add('show');
        setTimeout(() => {
            toastElement.classList.remove('show');
        }, 3000);
    }

    // --- I18n & Language Functions --- //

    /**
     * Synchronously loads translation data from a JSON file.
     * Uses Node.js fs module, suitable for Electron renderer process with nodeIntegration.
     * @param {string} lang - The language code (e.g., 'en', 'ja').
     * @returns {object} The translation object.
     */
    function loadTranslations(lang) {
        try {
            const filePath = path.join(__dirname, 'locales', `${lang}.json`);
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error(`Failed to load translations for ${lang}:`, error);
            // Fallback to English if the requested language fails
            if (lang !== 'en') {
                return loadTranslations('en'); // Recursive call for fallback
            }
            return {}; // Return empty if even English fails
        }
    }

    /**
     * Returns the translated string for a given key.
     * @param {string} key - The translation key.
     * @returns {string} The translated string or the key itself if not found.
     */
    function t(key) {
        return translations[key] || key;
    }

    /**
     * Sets the application language and updates the UI.
     * @param {string} lang - The language code to set.
     */
    async function setLanguage(lang) {
        currentLanguage = lang;
        translations = loadTranslations(lang);
        document.documentElement.lang = lang;
        languageSwitcher.value = lang;
        updateUIText();
        // Re-render currently visible content to apply language changes
        const activeTab = document.querySelector('nav button.active')?.id;
        if (activeTab === 'recipes-tab') displayRecipes();
        else if (activeTab === 'inventory-tab') displayInventory();
        else if (activeTab === 'shopping-list-tab') displayShoppingList();
        else if (activeTab === 'nutrition-graph-tab') updateNutritionGraph();
    }

    /**
     * Updates all UI elements with data-i18n attributes based on current translations.
     */
    function updateUIText() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            el.innerHTML = t(key);
        });
        document.title = t('appName');
    }

    languageSwitcher.addEventListener('change', (e) => setLanguage(e.target.value));

    // --- Modal Functions --- //

    function showModal() {
        modalOverlay.classList.remove('hidden');
    }

    function hideModal() {
        modalOverlay.classList.add('hidden');
        modalForm.innerHTML = '';
        modalTitle.innerHTML = '';
    }

    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            hideModal();
        }
    });

    /**
     * Displays a generic form modal.
     * @param {string} titleKey - Translation key for the modal title.
     * @param {string} formHtml - HTML string for the form content.
     * @param {function(object): void} handleSubmit - Callback function on form submission.
     */
    function showFormModal(titleKey, formHtml, handleSubmit) {
        modalTitle.innerHTML = t(titleKey);
        modalForm.innerHTML = formHtml;
        showModal();

        modalForm.onsubmit = (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            handleSubmit(data);
            hideModal();
        };
        // Attach event listener to the dynamically created cancel button
        const cancelButton = modalForm.querySelector('.cancel-btn');
        if (cancelButton) {
            cancelButton.onclick = hideModal;
        }
    }

    // --- IndexedDB Functions --- //

    /**
     * Opens the IndexedDB database.
     * @returns {Promise<IDBDatabase>} A promise that resolves with the database instance.
     */
    function openIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('NutriChefDB', 1);
            request.onupgradeneeded = (event) => {
                db = event.target.result;
                const recipeStore = db.createObjectStore('recipes', { keyPath: 'id', autoIncrement: true });
                recipeStore.createIndex('title', 'title', { unique: false });
                db.createObjectStore('inventory', { keyPath: 'name' });
            };
            request.onsuccess = (event) => {
                db = event.target.result;
                resolve(db);
            };
            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.errorCode);
                showToast(`Error: ${event.target.error.message || 'IndexedDB error'}`);
                reject('IndexedDB error:' + event.target.errorCode);
            };
        });
    }

    // --- UI Tab Functions --- //

    /**
     * Shows the specified tab section and updates active tab button.
     * @param {string} tabName - The name of the tab to show ('recipes', 'inventory', 'shopping-list', 'nutrition-graph').
     */
    function showTab(tabName) {
        recipesSection.classList.add('hidden-tab');
        inventorySection.classList.add('hidden-tab');
        shoppingListSection.classList.add('hidden-tab');
        nutritionGraphSection.classList.add('hidden-tab');

        recipesTab.classList.remove('active');
        inventoryTab.classList.remove('active');
        shoppingListTab.classList.remove('active');
        nutritionGraphTab.classList.remove('active');

        if (tabName === 'recipes') {
            recipesSection.classList.remove('hidden-tab');
            recipesTab.classList.add('active');
            displayRecipes();
        } else if (tabName === 'inventory') {
            inventorySection.classList.remove('hidden-tab');
            inventoryTab.classList.add('active');
            displayInventory();
        } else if (tabName === 'shopping-list') {
            shoppingListSection.classList.remove('hidden-tab');
            shoppingListTab.classList.add('active');
            displayShoppingList();
        } else if (tabName === 'nutrition-graph') {
            nutritionGraphSection.classList.remove('hidden-tab');
            nutritionGraphTab.classList.add('active');
            updateNutritionGraph();
        }
    }

    // --- Event Listeners --- //

    recipesTab.addEventListener('click', () => showTab('recipes'));
    inventoryTab.addEventListener('click', () => showTab('inventory'));
    shoppingListTab.addEventListener('click', () => showTab('shopping-list'));
    nutritionGraphTab.addEventListener('click', () => showTab('nutrition-graph'));

    addRecipeBtn.addEventListener('click', () => {
        const formHtml = `
            <label for="title">${t('labelTitle')}</label>
            <input type="text" id="title" name="title" required>
            <label for="content">${t('labelContent')}</label>
            <textarea id="content" name="content"></textarea>
            <label for="ingredients">${t('labelIngredients')}</label>
            <input type="text" id="ingredients" name="ingredients">
            <div class="form-buttons">
                <button type="submit" class="primary-btn">${t('saveButton')}</button>
                <button type="button" class="secondary-btn cancel-btn">${t('cancelButton')}</button>
            </div>
        `;
        showFormModal('modalAddRecipeTitle', formHtml, (data) => {
            const ingredients = data.ingredients.split(',').map(item => item.trim()).filter(Boolean);
            const recipe = { ...data, ingredients };
            const transaction = db.transaction(['recipes'], 'readwrite');
            transaction.objectStore('recipes').add(recipe).onsuccess = () => {
                showToast(t('recipeAdded'));
                displayRecipes();
                updateNutritionGraph();
            };
            transaction.onerror = (event) => {
                console.error('Error adding recipe:', event.target.error);
                showToast(`Error: ${event.target.error.message || 'Failed to add recipe'}`);
            };
        });
    });

    addInventoryBtn.addEventListener('click', () => {
        const formHtml = `
            <label for="name">${t('labelName')}</label>
            <input type="text" id="name" name="name" required>
            <label for="quantity">${t('labelQuantity')}</label>
            <input type="number" id="quantity" name="quantity" value="1" min="0" required>
            <div class="form-buttons">
                <button type="submit" class="primary-btn">${t('saveButton')}</button>
                <button type="button" class="secondary-btn cancel-btn">${t('cancelButton')}</button>
            </div>
        `;
        showFormModal('modalAddInventoryTitle', formHtml, (data) => {
            const item = { name: data.name, quantity: parseInt(data.quantity, 10) };
            const transaction = db.transaction(['inventory'], 'readwrite');
            transaction.objectStore('inventory').put(item).onsuccess = () => { // Use put to allow adding/updating
                showToast(t('inventoryAdded'));
                displayInventory();
            };
            transaction.onerror = (event) => {
                console.error('Error adding inventory item:', event.target.error);
                showToast(`Error: ${event.target.error.message || 'Failed to add inventory item'}`);
            };
        });
    });

    // --- Display & Button Listener Functions --- //

    async function displayRecipes() {
        recipeList.innerHTML = '';
        const transaction = db.transaction(['recipes'], 'readonly');
        const request = transaction.objectStore('recipes').getAll();
        request.onsuccess = (event) => {
            const recipes = event.target.result;
            recipes.forEach(recipe => {
                const div = document.createElement('div');
                div.className = 'recipe-item';
                div.innerHTML = `
                    <h3>${recipe.title}</h3>
                    <div>${marked.parse(recipe.content || '')}</div>
                    <p><strong>${t('labelIngredients')}:</strong> ${recipe.ingredients.join(', ')}</p>
                    <div class="item-actions">
                        <button data-id="${recipe.id}" class="primary-btn edit-recipe-btn">${t('editButton')}</button>
                        <button data-id="${recipe.id}" class="secondary-btn delete-recipe-btn">${t('deleteButton')}</button>
                    </div>
                `;
                recipeList.appendChild(div);
            });
            addRecipeButtonListeners();
        };
        request.onerror = (event) => {
            console.error('Error displaying recipes:', event.target.error);
            showToast(`Error: ${event.target.error.message || 'Failed to display recipes'}`);
        };
    }

    function addRecipeButtonListeners() {
        recipeList.querySelectorAll('.edit-recipe-btn').forEach(btn => {
            btn.onclick = (e) => {
                const idToEdit = parseInt(e.target.dataset.id);
                const transaction = db.transaction(['recipes'], 'readonly');
                const request = transaction.objectStore('recipes').get(idToEdit);
                request.onsuccess = (event) => {
                    const recipe = event.target.result;
                    const formHtml = `
                        <input type="hidden" name="id" value="${recipe.id}">
                        <label for="title">${t('labelTitle')}</label>
                        <input type="text" id="title" name="title" value="${recipe.title}" required>
                        <label for="content">${t('labelContent')}</label>
                        <textarea id="content" name="content">${recipe.content}</textarea>
                        <label for="ingredients">${t('labelIngredients')}</label>
                        <input type="text" id="ingredients" name="ingredients" value="${recipe.ingredients.join(', ')}">
                        <div class="form-buttons">
                            <button type="submit" class="primary-btn">${t('saveButton')}</button>
                            <button type="button" class="secondary-btn cancel-btn">${t('cancelButton')}</button>
                        </div>
                    `;
                    showFormModal('modalEditRecipeTitle', formHtml, (data) => {
                        const ingredients = data.ingredients.split(',').map(item => item.trim()).filter(Boolean);
                        const updatedRecipe = { ...data, id: parseInt(data.id), ingredients };
                        const putTransaction = db.transaction(['recipes'], 'readwrite');
                        putTransaction.objectStore('recipes').put(updatedRecipe).onsuccess = () => {
                            showToast(t('recipeUpdated'));
                            displayRecipes();
                            updateNutritionGraph();
                        };
                        putTransaction.onerror = (event) => {
                            console.error('Error updating recipe:', event.target.error);
                            showToast(`Error: ${event.target.error.message || 'Failed to update recipe'}`);
                        };
                    });
                };
            };
        });

        recipeList.querySelectorAll('.delete-recipe-btn').forEach(btn => {
            btn.onclick = (e) => {
                if (confirm(t('confirmDeleteRecipe'))) {
                    const idToDelete = parseInt(e.target.dataset.id);
                    const transaction = db.transaction(['recipes'], 'readwrite');
                    transaction.objectStore('recipes').delete(idToDelete).onsuccess = () => {
                        showToast(t('recipeDeleted'));
                        displayRecipes();
                        updateNutritionGraph();
                    };
                    transaction.onerror = (event) => {
                        console.error('Error deleting recipe:', event.target.error);
                        showToast(`Error: ${event.target.error.message || 'Failed to delete recipe'}`);
                    };
                }
            };
        });
    }

    async function displayInventory() {
        inventoryList.innerHTML = '';
        const transaction = db.transaction(['inventory'], 'readonly');
        const request = transaction.objectStore('inventory').getAll();
        request.onsuccess = (event) => {
            const inventoryItems = event.target.result;
            inventoryItems.forEach(item => {
                const div = document.createElement('div');
                div.className = 'inventory-item';
                div.innerHTML = `
                    <p>${item.name}: ${item.quantity} ${t('inventoryItemUnit')}</p>
                    <div class="item-actions">
                        <button data-name="${item.name}" class="primary-btn edit-inventory-btn">${t('editButton')}</button>
                        <button data-name="${item.name}" class="secondary-btn delete-inventory-btn">${t('deleteButton')}</button>
                    </div>
                `;
                inventoryList.appendChild(div);
            });
            addInventoryButtonListeners();
        };
        request.onerror = (event) => {
            console.error('Error displaying inventory:', event.target.error);
            showToast(`Error: ${event.target.error.message || 'Failed to display inventory'}`);
        };
    }

    function addInventoryButtonListeners() {
        inventoryList.querySelectorAll('.edit-inventory-btn').forEach(btn => {
            btn.onclick = (e) => {
                const nameToEdit = e.target.dataset.name;
                const transaction = db.transaction(['inventory'], 'readonly');
                const request = transaction.objectStore('inventory').get(nameToEdit);
                request.onsuccess = (event) => {
                    const item = event.target.result;
                    const formHtml = `
                        <label for="name">${t('labelName')}</label>
                        <input type="text" id="name" name="name" value="${item.name}" readonly>
                        <label for="quantity">${t('labelQuantity')}</label>
                        <input type="number" id="quantity" name="quantity" value="${item.quantity}" min="0" required>
                        <div class="form-buttons">
                            <button type="submit" class="primary-btn">${t('saveButton')}</button>
                            <button type="button" class="secondary-btn cancel-btn">${t('cancelButton')}</button>
                        </div>
                    `;
                    showFormModal('modalEditInventoryTitle', formHtml, (data) => {
                        const updatedItem = { name: data.name, quantity: parseInt(data.quantity, 10) };
                        const putTransaction = db.transaction(['inventory'], 'readwrite');
                        putTransaction.objectStore('inventory').put(updatedItem).onsuccess = () => {
                            showToast(t('inventoryUpdated'));
                            displayInventory();
                        };
                        putTransaction.onerror = (event) => {
                            console.error('Error updating inventory:', event.target.error);
                            showToast(`Error: ${event.target.error.message || 'Failed to update inventory'}`);
                        };
                    });
                };
            };
        });

        inventoryList.querySelectorAll('.delete-inventory-btn').forEach(btn => {
            btn.onclick = (e) => {
                if (confirm(t('confirmDeleteInventory'))) {
                    const nameToDelete = e.target.dataset.name;
                    const transaction = db.transaction(['inventory'], 'readwrite');
                    transaction.objectStore('inventory').delete(nameToDelete).onsuccess = () => {
                        showToast(t('inventoryItemDeleted'));
                        displayInventory();
                    };
                    transaction.onerror = (event) => {
                        console.error('Error deleting inventory item:', event.target.error);
                        showToast(`Error: ${event.target.error.message || 'Failed to delete inventory item'}`);
                    };
                }
            };
        });
    }

    async function displayShoppingList() {
        shoppingListContent.innerHTML = '';
        try {
            const recipes = await new Promise((resolve, reject) => {
                db.transaction('recipes').objectStore('recipes').getAll().onsuccess = e => resolve(e.target.result);
                db.transaction('recipes').objectStore('recipes').getAll().onerror = e => reject(e.target.error);
            });
            const inventory = await new Promise((resolve, reject) => {
                db.transaction('inventory').objectStore('inventory').getAll().onsuccess = e => resolve(e.target.result);
                db.transaction('inventory').objectStore('inventory').getAll().onerror = e => reject(e.target.error);
            });
            const inventoryMap = new Map(inventory.map(item => [item.name.toLowerCase(), item.quantity]));

            const neededItems = {};
            recipes.forEach(recipe => {
                recipe.ingredients.forEach(ingredient => {
                    const stock = inventoryMap.get(ingredient.toLowerCase()) || 0;
                    if (stock === 0) {
                        neededItems[ingredient] = (neededItems[ingredient] || 0) + 1;
                    }
                });
            });

            if (Object.keys(neededItems).length === 0) {
                shoppingListContent.innerHTML = `<p>${t('shoppingListEmpty')}</p>`;
                return;
            }

            const ul = document.createElement('ul');
            for (const item in neededItems) {
                const li = document.createElement('li');
                li.textContent = `${item} (x${neededItems[item]})`;
                ul.appendChild(li);
            }
            shoppingListContent.appendChild(ul);
        } catch (error) {
            console.error('Error displaying shopping list:', error);
            showToast(`Error: ${error.message || 'Failed to display shopping list'}`);
        }
    }

    // --- Nutrition Graph --- //
    const NUTRIENT_DATA = {
        '卵': { carbs: 0.6, protein: 12.6, fat: 10.6 }, 'egg': { carbs: 0.6, protein: 12.6, fat: 10.6 },
        '牛乳': { carbs: 4.8, protein: 3.3, fat: 3.8 }, 'milk': { carbs: 4.8, protein: 3.3, fat: 3.8 },
        '砂糖': { carbs: 100, protein: 0, fat: 0 }, 'sugar': { carbs: 100, protein: 0, fat: 0 },
        'じゃがいも': { carbs: 17.5, protein: 2.0, fat: 0.1 }, 'potato': { carbs: 17.5, protein: 2.0, fat: 0.1 },
        '玉ねぎ': { carbs: 7.6, protein: 1.1, fat: 0.1 }, 'onion': { carbs: 7.6, protein: 1.1, fat: 0.1 },
        '豚肉': { carbs: 0, protein: 22.0, fat: 15.0 }, 'pork': { carbs: 0, protein: 22.0, fat: 15.0 },
        '人参': { carbs: 8.2, protein: 0.9, fat: 0.2 }, 'carrot': { carbs: 8.2, protein: 0.9, fat: 0.2 },
    };

    async function updateNutritionGraph() {
        try {
            const recipes = await new Promise((resolve, reject) => {
                const request = db.transaction(['recipes'], 'readonly').objectStore('recipes').getAll();
                request.onsuccess = e => resolve(e.target.result);
                request.onerror = e => reject(e.target.error);
            });

            let totalCarbs = 0, totalProtein = 0, totalFat = 0;

            recipes.forEach(recipe => {
                (recipe.ingredients || []).forEach(ingredient => {
                    const nutrient = NUTRIENT_DATA[ingredient.toLowerCase()];
                    if (nutrient) {
                        totalCarbs += nutrient.carbs;
                        totalProtein += nutrient.protein;
                        totalFat += nutrient.fat;
                    }
                });
            });

            const data = [totalCarbs, totalProtein, totalFat];
            const totalNutrients = totalCarbs + totalProtein + totalFat;
            const ctx = nutritionChartCanvas.getContext('2d');

            // If there is no data, display a message
            if (totalNutrients === 0) {
                if (nutritionChart) {
                    nutritionChart.destroy();
                    nutritionChart = null;
                }
                ctx.clearRect(0, 0, nutritionChartCanvas.width, nutritionChartCanvas.height);
                ctx.save();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#aaa';
                ctx.font = "16px 'Roboto', 'Noto Sans JP', sans-serif";
                ctx.fillText(t('graphEmptyMessage'), nutritionChartCanvas.width / 2, nutritionChartCanvas.height / 2);
                ctx.restore();
                return;
            }

            const labels = [t('chartLabelCarbs'), t('chartLabelProtein'), t('chartLabelFat')];

            if (nutritionChart) {
                nutritionChart.data.datasets[0].data = data;
                nutritionChart.data.labels = labels;
                nutritionChart.options.plugins.title.text = t('chartTitle');
                nutritionChart.update();
            } else {
                nutritionChart = new Chart(ctx, {
                    type: 'pie',
                    data: {
                        labels: labels,
                        datasets: [{ data: data, backgroundColor: ['#4a90e2', '#50e3c2', '#f5a623'] }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'top' },
                            title: { display: true, text: t('chartTitle') }
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Error updating nutrition graph:', error);
            showToast(`Error: ${error.message || 'Failed to update nutrition graph'}`);
        }
    }

    // --- Initialization --- //
    async function init() {
        try {
            await openIndexedDB();
            const userLang = navigator.language.startsWith('ja') ? 'ja' : 'en';
            await setLanguage(userLang);
            showTab('recipes'); // Default to recipes tab
        } catch (error) {
            console.error('Initialization failed:', error);
            const mainContent = document.querySelector('main');
            mainContent.innerHTML = '<p style="color: red; text-align: center;">Application could not start. Please enable IndexedDB and try again.</p>';
            showToast(`Critical Error: ${error.message || 'Application failed to start'}`);
        }
    }

    init();
});