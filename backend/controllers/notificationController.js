const { Notification } = require("../models");
const { buildQuery, paginated } = require("../utils/query");

/**
 * @desc    Get current user's notifications & unread count
 * @route   GET /api/notifications
 */
const getMyNotifications = async (req, res, next) => {
  try {
    const { isRead } = req.query;

    const where = {
      companyId: req.companyId,
      recipientId: req.user.id,
    };

    if (isRead !== undefined) {
      where.isRead = isRead === "true" || isRead === true;
    }

    const query = buildQuery(req, {
      where,
      sortable: ["createdAt", "isRead"],
      defaultOrder: [["createdAt", "DESC"]],
    });

    const result = await Notification.findAndCountAll(query);
    const unreadCount = await Notification.count({
      where: {
        companyId: req.companyId,
        recipientId: req.user.id,
        isRead: false,
      },
    });

    const response = paginated(req, result);
    response.unreadCount = unreadCount;

    return res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark a single notification as read
 * @route   PATCH /api/notifications/:id/read
 */
const markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOne({
      where: {
        id: req.params.id,
        companyId: req.companyId,
        recipientId: req.user.id,
      },
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    notification.isRead = true;
    await notification.save();

    return res.json({ message: "Notification marked as read", notification });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark all notifications as read for current user
 * @route   PATCH /api/notifications/read-all
 */
const markAllAsRead = async (req, res, next) => {
  try {
    await Notification.update(
      { isRead: true },
      {
        where: {
          companyId: req.companyId,
          recipientId: req.user.id,
          isRead: false,
        },
      }
    );

    return res.json({ message: "All notifications marked as read" });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a notification
 * @route   DELETE /api/notifications/:id
 */
const deleteNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findOne({
      where: {
        id: req.params.id,
        companyId: req.companyId,
        recipientId: req.user.id,
      },
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    await notification.destroy();
    return res.json({ message: "Notification deleted" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
