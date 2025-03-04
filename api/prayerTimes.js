export const getPrayerTimesByCity = async (city, country) => {
    try {
      const response = await fetch(
        `http://api.aladhan.com/v1/timingsByCity?city=${city}&country=${country}&method=4`
      );
      const data = await response.json();
  
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
  