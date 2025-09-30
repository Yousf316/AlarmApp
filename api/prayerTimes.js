export const getPrayerTimesByCity = async (city, country) => {
    try {
      const response = await fetch(
        `https://api.aladhan.com/v1/timingsByCity?city=${city}&country=${country}&method=4`
        
      );
      const data = await response.json();
      console.log("API Response:", data);
      if (data.code === 200) {
        return data.data.timings;
      } else {
        console.error("Error fetching prayer times:", data);
        return null;
      }
    } catch (error) {
      console.error("API Error:", error);
      return null;
    }
  };
  export const getPrayerTimesByCityandDate = async (city, country, date = new Date()) => {
    try {
        // Convert the date to a Unix timestamp (seconds)
        const timestamp = Math.floor(date.getTime() / 1000);

        const response = await fetch(
            `http://api.aladhan.com/v1/timings/${timestamp}?city=${city}&country=${country}&method=4`
        );

        const data = await response.json();
        console.log("API Response:", data);

        if (data.code === 200) {
            return data.data.timings;
        } else {
            console.error("Error fetching prayer times:", data);
            return null;
        }
    } catch (error) {
        console.error("API Error:", error);
        return null;
    }
};


export const getPrayerTimesForNextDays = async (city, country, daysAhead = 7) => {
  try {
      const today = new Date();
      let month = today.getMonth() + 1;
      let year = today.getFullYear();

      let allPrayerTimes = [];

      // Fetch current month data
      const response = await fetch(
          `http://api.aladhan.com/v1/calendarByCity?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=4&month=${month}&year=${year}`
      );
      const data = await response.json();

      if (data.code !== 200) {
          console.error("Error fetching prayer times:", data);
          return null;
      }

      let prayerTimes = data.data;
      const daysInCurrentMonth = prayerTimes.length;

      let remainingDays = daysAhead;
      let dayIndex = today.getDate() - 1;

      // Add days from current month
      while (remainingDays > 0 && dayIndex < daysInCurrentMonth) {
          allPrayerTimes.push({
              date: prayerTimes[dayIndex].date.gregorian.date,
              timings: prayerTimes[dayIndex].timings,
          });
          remainingDays--;
          dayIndex++;
      }

      // If more days are needed, fetch the next month
      if (remainingDays > 0) {
          month++;
          if (month > 12) {
              month = 1;
              year++;
          }

          const nextMonthResponse = await fetch(
              `http://api.aladhan.com/v1/calendarByCity?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=4&month=${month}&year=${year}`
          );
          const nextMonthData = await nextMonthResponse.json();

          if (nextMonthData.code === 200) {
              const nextMonthPrayerTimes = nextMonthData.data;

              for (let i = 0; i < remainingDays && i < nextMonthPrayerTimes.length; i++) {
                  allPrayerTimes.push({
                      date: nextMonthPrayerTimes[i].date.gregorian.date,
                      timings: nextMonthPrayerTimes[i].timings,
                  });
              }
          }
      }

      return allPrayerTimes;
  } catch (error) {
      console.error("API Error:", error);
      return null;
  }
};

