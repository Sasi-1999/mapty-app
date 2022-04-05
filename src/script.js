'use strict';

import 'core-js/stable';
import 'regenerator-runtime/runtime';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  constructor(coords, distance, duration) {
    this.coords = coords;
    this.distance = distance;
    this.duration = duration;
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
}

class Running extends Workout {
  type = 'running';
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, distance, duration, elevation) {
    super(coords, distance, duration);
    this.elevation = elevation;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/hr
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

// APP ARCHITECTURE
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const overviewBtn = document.querySelector('.workout__overview');
const sortBtnKm = document.querySelector('.workout__sort--distance');
const sortBtnDate = document.querySelector('.workout__sort--date');
const resetBtn = document.querySelector('.workout__reset');

class App {
  #map;
  #mapEvent;
  #mapZoomLevel = 13;
  #workouts = [];
  #markers = [];
  #sortKm = 'increase';
  #sortDate = 'increase';
  constructor() {
    // Get current Location
    this._getPosition();

    // Get local storage
    this._getLocalStorage();

    // Attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._movetoPopup.bind(this));
    overviewBtn.addEventListener('click', this._setOverview.bind(this));
    sortBtnKm.addEventListener('click', this._sortByKm.bind(this));
    sortBtnDate.addEventListener('click', this._sortByDate.bind(this));
    containerWorkouts.addEventListener('click', this._deleteWorkout.bind(this));
    containerWorkouts.addEventListener('click', this._editWorkout.bind(this));
    resetBtn.addEventListener('click', this._resetWorkout.bind(this));
  }

  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your location');
        }
      );
    }
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    // Render workout marker
    this.#workouts.forEach(workout => this._renderWorkoutMarker(workout));
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _createWorkout(coords) {
    // Validate Inputs
    const isFinite = (...inputs) => inputs.every(inp => Number.isFinite(inp));
    const isPositive = (...inputs) => inputs.every(inp => inp > 0);

    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    let newWorkout;

    if (type === 'running') {
      const cadence = +inputCadence.value;

      if (
        !isFinite(distance, duration, cadence) ||
        !isPositive(distance, duration, cadence)
      )
        return alert('Not a valid input');

      newWorkout = new Running(coords, distance, duration, cadence);
    }

    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      if (
        !isFinite(distance, duration, elevation) ||
        !isPositive(distance, duration)
      )
        return alert('Not a valid input');

      newWorkout = new Cycling(coords, distance, duration, elevation);
    }

    // Create running and cycling objects
    this.#workouts.push(newWorkout);

    // Hide form and Clear inputs
    this._hideForm();

    // Render workout on list
    this._renderWorkout(newWorkout);

    // Render workout on map as marker
    this._renderWorkoutMarker(newWorkout);
  }

  _newWorkout(e, workout = null, workoutEl = null) {
    e.preventDefault();

    if (!this.#map) return;

    // Edited workout
    if (workout) {
      const [lat, lng] = workout.coords;

      // Create workout
      this._createWorkout([lat, lng]);

      // deleting workout
      const index = this.#workouts.indexOf(workout);

      this.#workouts.splice(index, 1);
      workoutEl.remove();

      const marker = this.#markers.find(
        marker => marker._leaflet_id === workout.markerId
      );
      marker.remove();
    }

    // New workout
    if (workout === null) {
      const { lat, lng } = this.#mapEvent.latlng;

      // Create workout
      this._createWorkout([lat, lng]);
    }
    // Set local storage
    this._setLocalStorage();
  }

  _renderWorkout(workout) {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <h2 class="workout__title">${workout.description}</h2>        
        <div class="workout__settings workout__edit"><i class="fas fa-edit fa-lg"></i></div>
        <div class="workout__settings workout__delete"><i class="far fa-trash-alt fa-lg"></i></div>
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
          }</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
        `;

    if (workout.type === 'running') {
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
      </li>`;
    }

    if (workout.type === 'cycling') {
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevation}</span>
          <span class="workout__unit">m</span>
        </div>
      </li>`;
    }

    form.insertAdjacentHTML('afterend', html);
  }

  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          maxHeight: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();

    this.#markers.push(marker);
    workout.markerId = marker._leaflet_id;
  }

  _movetoPopup(e) {
    if (!this.#map) return;

    const settingsEl = e.target.closest('.workout__settings');
    if (settingsEl) return;

    const workoutEl = e.target.closest('.workout');
    if (!workoutEl) return;

    const workout = this.#workouts.find(
      workout => workout.id === workoutEl.dataset.id
    );

    // Set view
    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  _setOverview() {
    if (!this.#map) return;
    if (this.#workouts.length === 0) return;

    // get lowest and highest lat and long to make map bounds for overview
    const latitudes = this.#workouts.map(workout => workout.coords[0]);
    const longitudes = this.#workouts.map(workout => workout.coords[1]);

    const maxLat = Math.max(...latitudes);
    const minLat = Math.min(...latitudes);
    const maxLng = Math.max(...longitudes);
    const minLng = Math.min(...longitudes);

    this.#map.fitBounds(
      [
        [maxLat, minLng],
        [minLat, maxLng],
      ],
      { padding: [100, 100] }
    );
  }

  _sortByKm() {
    console.log(this.#sortKm);
    if (this.#workouts.length === 0) return;

    document
      .querySelectorAll('.workout')
      .forEach(workout => (workout.style.display = 'none'));

    this.#sortKm === 'decrease'
      ? this.#workouts.sort((a, b) => a.distance - b.distance)
      : this.#workouts.sort((a, b) => b.distance - a.distance);

    this.#workouts.forEach(workout => this._renderWorkout(workout));
    console.log(this.#workouts);

    this.#sortKm === 'increase'
      ? (this.#sortKm = 'decrease')
      : (this.#sortKm = 'increase');
  }

  _sortByDate() {
    console.log(this.#sortDate);
    if (this.#workouts.length === 0) return;

    document
      .querySelectorAll('.workout')
      .forEach(workout => (workout.style.display = 'none'));

    this.#sortDate === 'decrease'
      ? this.#workouts.sort((a, b) => new Date(a.date) - new Date(b.date))
      : this.#workouts.sort((a, b) => new Date(b.date) - new Date(a.date));

    this.#workouts.forEach(workout => this._renderWorkout(workout));
    console.log(this.#workouts);

    this.#sortDate === 'increase'
      ? (this.#sortDate = 'decrease')
      : (this.#sortDate = 'increase');
  }

  _editWorkout(e) {
    if (!this.#map) return;

    const editWorkoutEl = e.target.closest('.workout__edit');
    if (!editWorkoutEl) return;

    const workoutEl = e.target.closest('.workout');
    const workout = this.#workouts.find(
      workout => workout.id === workoutEl.dataset.id
    );

    // Show form to be edited
    this._showEditableForm(workout);

    // Hide rendered workout
    workoutEl.style.display = 'none';

    // render edited workout
    form.addEventListener(
      'submit',
      this._newWorkout.bind(this, e, workout, workoutEl)
    );
  }

  _deleteWorkout(e) {
    if (!this.#map) return;

    const deleteWorkoutEl = e.target.closest('.workout__delete');
    if (!deleteWorkoutEl) return;

    const workoutEl = e.target.closest('.workout');
    const workout = this.#workouts.find(
      workout => workout.id === workoutEl.dataset.id
    );
    const index = this.#workouts.indexOf(workout);

    // Remove workout
    this.#workouts.splice(index, 1);
    workoutEl.remove();

    // Remove marker
    const marker = this.#markers.find(
      marker => marker._leaflet_id === workout.markerId
    );
    marker.remove();

    // set local storage after deleting workouts
    this._setLocalStorage();
  }

  _resetWorkout() {
    if (!this.#map) return;
    if (this.#workouts.length === 0) return;

    const workoutEl = document.querySelectorAll('.workout');

    // Empty workouts array
    this.#workouts.length = 0;

    // Remove workout elements
    workoutEl.forEach(workout => workout.remove());

    // Remove markers
    this.#markers.forEach(marker => marker.remove());

    // Set local storage after deleting workouts
    this._setLocalStorage();
  }

  _showEditableForm(workout) {
    this._showForm();

    // Retain input values
    inputType.value = workout.type;
    inputDistance.value = workout.distance;
    inputDuration.value = workout.duration;

    if (inputType.value === 'running') inputCadence.value = workout.cadence;
    if (inputType.value === 'cycling') inputElevation.value = workout.elevation;
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
    // localStorage.setItem('sort', JSON.stringify(this.#sort));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));
    // this.#sort = JSON.parse(localStorage.getItem('sort'));

    if (!data) return;

    this.#workouts = data;

    this.#workouts.forEach(workout => this._renderWorkout(workout));
    console.log(this.#workouts);
  }
}

const app = new App();
