import nodemailer from "nodemailer";
import config from "../config/config";

export class EmailService {
  private transporter;

  constructor() {
    console.log({
      user: config.smtp.user,
      pass: config.smtp.pass,
    });
    this.transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: false,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });

    // Verify the connection
    this.transporter.verify(function (error, success) {
      if (error) {
        console.log(error);
      } else {
        console.log("Server is ready to take our messages");
      }
    });
  }

  async sendEmail(to: string, subject: string, content: string) {
    const mailOptions = {
      from: config.EMAIL_FROM,
      to: to,
      subject: subject,
      html: content,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log("Email sent: %s", info.messageId);
    } catch (error) {
      console.error("Error sending email:", error);
    }
  }
}
