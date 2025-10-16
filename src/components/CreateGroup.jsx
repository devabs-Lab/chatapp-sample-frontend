import React, { useState } from "react";
import classes from "../pages/styling/chat.module.css";

const CreateGroup = ({ onCreateGroup }) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    is_private: false,
  });

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    onCreateGroup(formData);
    setFormData({
      name: "",
      description: "",
      is_private: false,
    });
  };

  return (
    <div className={classes.createGroupContainer}>
      <h3>Create New Group</h3>
      <form onSubmit={handleSubmit} className={classes.createGroupForm}>
        <div className={classes.formGroup}>
          <label htmlFor="name">Group Name *</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="Enter group name"
            required
            className={classes.formInput}
          />
        </div>

        <div className={classes.formGroup}>
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Describe your group's purpose"
            rows="3"
            className={classes.formTextarea}
          />
        </div>

        <div className={classes.formGroup}>
          <label className={classes.checkboxLabel}>
            <input
              type="checkbox"
              name="is_private"
              checked={formData.is_private}
              onChange={handleInputChange}
              className={classes.checkbox}
            />
            <span>Private Group (invitation only)</span>
          </label>
        </div>

        <div className={classes.formActions}>
          <button type="submit" className={classes.createButton}>
            Create Group
          </button>
        </div>
      </form>

      <div className={classes.createGroupInfo}>
        <h4>Group Guidelines:</h4>
        <ul>
          <li>Choose a descriptive name for your group</li>
          <li>Set an appropriate member limit</li>
          <li>Private groups require invitations to join</li>
          <li>You'll be the admin of groups you create</li>
        </ul>
      </div>
    </div>
  );
};

export default CreateGroup;
