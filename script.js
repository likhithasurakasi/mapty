"use strict";

// prettier-ignore
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const form = document.querySelector(".form");
const containerWorkouts = document.querySelector(".workouts");
const inputType = document.querySelector(".form__input--type");
const inputDistance = document.querySelector(".form__input--distance");
const inputDuration = document.querySelector(".form__input--duration");
const inputCadence = document.querySelector(".form__input--cadence");
const inputElevation = document.querySelector(".form__input--elevation");
const btnclearAll = document.querySelector(".clear__all");
const btnsort = document.querySelector(".sort");
const errorText = document.querySelector(".error");
const copyright = document.querySelector(".copyright");
const showAll = document.querySelector(".showAll");
const icon = document.querySelector(".icon");

class Workout {
  date = new Date();
  id = (Date.now() + "").slice(-15);
  marker;
  // prettier-ignore
  constructor(coords,distance,duration,time,tunit,temp,icon,city,country ) {
    this.coords = coords; // [lat,lng]
    this.distance = distance; //[km]
    this.duration = duration; //[min]
    this.time=time;
    this.tunit=tunit;
    this.temp=temp;
    this.icon=icon;
    this.city=city;
    this.country=country;
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
  type = "running";
  // prettier-ignore
  constructor(coords,distance,duration,cadence,time,tunit,temp,icon,city,country
  ) {
    super(coords, distance, duration, time, tunit, temp, icon, city, country);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = "cycling";
  // prettier-ignore
  constructor(coords,distance,duration,elevGain,time,tunit,temp,icon,city,country
  ) {
    super(coords, distance, duration, time, tunit, temp, icon, city, country);
    this.elevGain = elevGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

class App {
  #map;
  #mapEvent;
  #workouts = [];
  #mapZoomLevel = 10;
  sorted = false;

  static validInputs = (...inputs) =>
    inputs.every((inp) => Number.isFinite(inp));

  static positiveInputs = (...inputs) => inputs.every((inp) => inp > 0);

  constructor() {
    // get users position
    this._getPosition();
    // get data from local storage
    this._getLocalStorage();
    //hide icon
    if (this.#workouts.length) icon.classList.add("hidden");
    // event handlers
    form.addEventListener("submit", this._newWorkout.bind(this));
    inputType.addEventListener("change", this._toggleElevationField);
    containerWorkouts.addEventListener("click", this._workoutEvent.bind(this));
    btnclearAll.addEventListener("click", this._clearAll.bind(this));
    btnsort.addEventListener("click", this._sort.bind(this));
    showAll.addEventListener("click", this._showAll.bind(this));
  }
  _showAll() {
    const markers = this.#workouts.map((w) => w.marker);
    const markersLayer = L.featureGroup(markers);
    this.#map.fitBounds(markersLayer.getBounds().pad(0.5));
  }
  _sort() {
    // remove all workouts from DOM
    containerWorkouts.childNodes.forEach(function (node) {
      if (node?.classList?.contains("workout")) {
        node.remove();
      }
    });
    if (this.sorted) {
      // render unsorted
      this.#workouts.forEach((w) => this._renderWorkout(w));
      this.sorted = !this.sorted;
      return;
    }
    const workoutsCopy = this.#workouts.slice();
    let sortedWorkouts;
    if (document.getElementById("duration").checked) {
      sortedWorkouts = workoutsCopy.sort((a, b) => a.duration - b.duration);
      // blur input
      document.getElementById("duration").checked = false;
    }
    if (document.getElementById("distance").checked) {
      sortedWorkouts = workoutsCopy.sort((a, b) => a.distance - b.distance);
      // blur input
      document.getElementById("distance").checked = false;
    }
    sortedWorkouts?.forEach((w) => this._renderWorkout(w));
    this.sorted = !this.sorted;
  }
  _clearAll() {
    // remove markers
    this.#workouts.forEach((w) => this.#map.removeLayer(w.marker));
    // empty workouts
    this.#workouts.length = 0;
    // remove from DOM
    containerWorkouts.childNodes.forEach(function (node) {
      if (node?.classList?.contains("workout")) {
        node.remove();
      }
    });
    // store
    this._setLocalStorage();
    // show icon
    icon.classList.remove("hidden");
  }
  _getPosition() {
    navigator.geolocation?.getCurrentPosition(
      this._loadMap.bind(this),
      this._showError.bind(
        this,
        "💥 could not get your position, please reload 💥"
      )
    );
  }
  _loadMap(position) {
    const { latitude, longitude } = position.coords;
    const coords = [latitude, longitude];
    this.#map = L.map("map").setView(coords, this.#mapZoomLevel);
    L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);
    // do only after map loads
    this.#map.on("click", this._showForm.bind(this));
    this.#workouts.forEach((w) => (w.marker = this._renderWorkoutMarker(w)));
  }

  _showForm(mapE) {
    // hide icon
    icon.classList.add("hidden");
    this.#mapEvent = mapE;
    form.classList.remove("hidden");
    inputDistance.focus();
  }

  _hideForm() {
    inputCadence.value = inputDistance.value = inputDuration.value = inputElevation.value =
      "";
    form.style.display = "none";
    form.classList.add("hidden");
    setTimeout(() => (form.style.display = "grid"), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest(".form__row").classList.toggle("form__row--hidden");
    inputCadence.closest(".form__row").classList.toggle("form__row--hidden");
  }

  async _newWorkout(e) {
    let workout;
    const formatTime = function () {
      const date = new Date(Date.now());
      const hours = `${date.getHours() % 12}`.padStart(2, 0);
      const mins = `${date.getMinutes()}`.padStart(2, 0);
      const time = `${hours}:${mins}`;
      const tunit = date.getHours() >= 12 ? "PM" : "AM";
      return [time, tunit];
    };
    const getWeather = async function (lat, lng) {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=28dc5b55749811e92b813b04ffdeb014`
      );
      if (!response.ok) return;
      const data = await response.json();
      const icon = `http://openweathermap.org/img/w/${data.weather[0].icon}.png`;
      return [(data.main.temp - 273).toFixed(0), icon];
    };
    const getLocation = async function (lat, lng) {
      const response = await fetch(
        `https://us1.locationiq.com/v1/reverse.php?key=pk.80ef52d1b29d1b14b53da653709c01f1&lat=${lat}&lon=${lng}&normalizeaddress=1&format=json`
      );
      if (!response.ok) return;
      const data = await response.json();
      return data.display_name.split(",").slice(0, 2) || ["", ""];
    };
    e.preventDefault();
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    const [time, tunit] = formatTime();

    try {
      const [[temp, icon], [city, country]] = await Promise.all([
        getWeather(lat, lng),
        getLocation(lat, lng),
      ]);
      if (type === "running") {
        const cadence = +inputCadence.value;
        if (
          !App.validInputs(distance, duration, cadence) ||
          !App.positiveInputs(distance, duration, cadence)
        )
          return this._showError("💥 inputs should be positive number 💥");
        // prettier-ignore
        workout = new Running([lat, lng], distance, duration, cadence, time, tunit, temp, icon, city, country
        );
      }
      if (type === "cycling") {
        const elevGain = +inputElevation.value;

        if (
          !validInputs(distance, duration, elevGain) ||
          !positiveInputs(duration, distance)
        )
          return this._showError("💥 inputs should be positive numbers 💥");

        // prettier-ignore
        workout = new Cycling([lat, lng],distance,duration,elevGain,time,tunit, temp,icon, city,country
        );
      }
      workout.marker = await this._renderWorkoutMarker(workout);
      this.#workouts.push(workout);
      this._setLocalStorage();
      this._renderWorkout(workout);
      this._hideForm();
    } catch {
      () => this._showError("💥 something is not right 💥");
    }
  }

  _showError(msg) {
    copyright.style.opacity = 0;
    document.querySelector(".overlay").style.opacity = 100;
    errorText.textContent = msg;
    setTimeout(function () {
      document.querySelector(".overlay").style.opacity = 0;
      copyright.style.opacity = 100;
    }, 4000);
  }

  _renderWorkoutMarker(workout) {
    return L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          minwidth: 100,
          maxwidth: 250,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === "running" ? "🏃‍♂️" : "🚴‍♀️"} ${workout.description}`
      )
      .openPopup();
  }

  _renderWorkout(workout, edit = false, workoutel = null) {
    let html = `
    <li class="workout workout--${workout.type}" data-id="${workout.id}">
    <h2 class="workout__title">${workout.description}</h2>
    <div style="grid-column: 4; text-align: right">
       <span class="material-icons" id="edit"> create </span>
       <span class="material-icons" id="clear"> clear </span>
     </div>
    <div class="workout__details">
      <span class="workout__icon">${
        workout.type === "running" ? "🏃‍♂️" : "🚴‍♂️"
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

    if (workout.type === "running")
      html += `
    <div class="workout__details">
      <span class="workout__icon">⚡</span>
      <span class="workout__value">${workout.pace.toFixed(1)}</span>
      <span class="workout__unit">min/km</span>
    </div>
    <div class="workout__details">
      <span class="workout__icon">👟</span>
      <span class="workout__value">${workout.cadence}</span>
      <span class="workout__unit">spm</span>
    </div>`;

    if (workout.type === "cycling")
      html += `<div class="workout__details">
    <span class="workout__icon">⚡️</span>
    <span class="workout__value">${workout.speed.toFixed(2)}</span>
    <span class="workout__unit">km/h</span>
  </div>
  <div class="workout__details">
    <span class="workout__icon">⛰</span>
    <span class="workout__value">${workout.elevGain}</span>
    <span class="workout__unit">m</span>
  </div>
`;

    html += `<div class="workout__async">
    <div class="workout__details" style="align-items:initial">
<img
    src=${workout.icon}
   style="height: 2.5rem;
   margin-right: 0.5rem;"
  />
  <span
    class="workout__value"
    >${workout.temp}</span
  >
      <span class="workout__unit" style="padding-right:4px">°c</span>
    </div>
    <div class="workout__details">
      <span class="workout__icon">⏱</span>
      <span class="workout__value">${workout.time}</span>
      <span class="workout__unit">${workout.tunit}</span>
    </div>
    <div class="workout__details workout__place__details">
      <span class="workout__icon">📍</span>
      <div class="workout__value">${workout.city},</div>
      <div class="workout__unit">${workout.country}</div>
    </div>
  </div>
  </li>`;
    if (edit) {
      workoutel.insertAdjacentHTML("afterend", html);
    } else form.insertAdjacentHTML("afterend", html);
  }

  _workoutEvent(e) {
    const editWorkout = function (e) {
      e.preventDefault();
      const editForm = document.querySelector(".edit");
      const editDistance = editForm.querySelector(".form__input--distance");
      const editDuration = editForm.querySelector(".form__input--duration");
      const editCadence = editForm.querySelector(".form__input--cadence");
      const editElevation = editForm.querySelector(".form__input--elevation");
      const distance = +editDistance.value;
      const duration = +editDuration.value;
      if (workout.type === "running") {
        const cadence = +editCadence.value;

        if (
          !App.validInputs(distance, duration, cadence) ||
          !App.positiveInputs(distance, duration, cadence)
        )
          return this._showError("💥 Inputs should be positive numbers 💥");

        this.#workouts[index].distance = distance;
        this.#workouts[index].duration = duration;
        this.#workouts[index].cadence = cadence;
        this.#workouts[index].calcPace();
      }
      if (workout.type === "cycling") {
        const elevGain = +editElevation.value;

        if (
          !App.validInputs(distance, duration, elevGain) ||
          !App.positiveInputs(duration, distance)
        )
          return this._showError("💥 Inputs should be positive numbers 💥");
        this.#workouts[index].distance = distance;
        this.#workouts[index].duration = duration;
        this.#workouts[index].elevGain = elevGain;
        this.#workouts[index].calcSpeed();
      }
      this._renderWorkout(workout, true, workoutel);

      editForm.style.display = "none";
      this._setLocalStorage();
    };
    const workoutel = e.target.closest(".workout");
    if (!workoutel) return;
    let workout, index;
    this.#workouts.forEach((w, i) => {
      if (w.id === workoutel.dataset.id) {
        workout = w;
        index = i;
      }
    });
    if (e.target.classList.contains("material-icons")) {
      if (e.target.id === "clear") {
        this.#workouts.splice(index, 1);
        if (!this.#workouts.length) icon.classList.remove("hidden");
        this.#map.removeLayer(workout.marker);
        workoutel.remove();
        this._setLocalStorage();
      }
      if (e.target.id === "edit") {
        workoutel.style.display = "none";
        const html = ` <form class="form edit">
        <div class="form__row">
          <label class="form__label">Type</label>
          <label class="editType">${workout.type}</label>
        </div>
        <div class="form__row">
          <label class="form__label">Distance</label>
          <input
            class="form__input form__input--distance"
            placeholder="km"
            type="text"
          />
        </div>
        <div class="form__row">
          <label class="form__label">Duration</label>
          <input
            class="form__input form__input--duration"
            placeholder="min"
            type="text"
          />
        </div>
        <div class="form__row">
          <label class="form__label">Cadence</label>
          <input
            class="form__input form__input--cadence"
            placeholder="step/min"
            type="text"
          />
        </div>
        <div class="form__row form__row--hidden">
          <label class="form__label">Elev Gain</label>
          <input
            class="form__input form__input--elevation"
            placeholder="meters"
            type="text"
          />
        </div>
        <button class="form__btn">OK</button>
      </form>`;
        workoutel.insertAdjacentHTML("afterEnd", html);
        const editForm = document.querySelector(".edit");
        editForm.addEventListener("submit", editWorkout.bind(this));
      }
    } else {
      this.#map.setView(workout.coords, this.#mapZoomLevel, {
        animate: true,
        pan: {
          duration: 2,
        },
      });
    }
  }

  _setLocalStorage() {
    const markers = this.#workouts.map((w) => w.marker);
    this.#workouts.forEach((w) => (w.marker = null));
    localStorage.setItem("workouts", JSON.stringify(this.#workouts));
    this.#workouts.forEach((w, i) => (w.marker = markers[i]));
  }
  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem("workouts"));
    if (!data) return;
    this.#workouts = data;
    this.#workouts = this.#workouts.map((w) => {
      this._renderWorkout(w);
      Object.setPrototypeOf(
        w,
        (w.type = "running" ? Running.prototype : Cycling.prototype)
      );
      return w;
    });
  }
  reset() {
    localStorage.removeItem("workouts");
    location.reload();
  }
}

const app = new App();
